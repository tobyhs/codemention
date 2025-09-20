import * as core from '@actions/core'
import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import {randomUUID} from 'crypto'
import {mockDeep} from 'jest-mock-extended'

import {CommentUpserterImpl} from '../src/comment-upserter'
import {ConfigurationReaderImpl} from '../src/configuration-reader'
import {FilesChangedReaderImpl} from '../src/files-changed-reader'
import {run} from '../src/main'
import Runner from '../src/runner'

jest.mock('@actions/core')
jest.mock('@actions/github')

jest.mock('../src/comment-upserter')
jest.mock('../src/configuration-reader')
jest.mock('../src/files-changed-reader')
jest.mock('../src/runner')

describe('run', () => {
  const githubToken = randomUUID()
  let octokit: InstanceType<typeof GitHub>
  let octokitRest: RestEndpointMethods

  beforeEach(() => {
    jest.mocked(core).getInput.mockImplementation(input => {
      if (input === 'githubToken') {
        return githubToken
      } else {
        throw new Error(`Unexpected input: ${input}`)
      }
    })

    octokit = mockDeep<InstanceType<typeof GitHub>>()
    octokitRest = octokit.rest
    jest.mocked(github).getOctokit.mockReturnValue(octokit)
  })

  it('calls Runner.run', async () => {
    await run()

    expect(github.getOctokit).toHaveBeenCalledWith(githubToken)
    expect(jest.mocked(ConfigurationReaderImpl)).toHaveBeenCalledWith(
      octokitRest,
    )
    expect(jest.mocked(FilesChangedReaderImpl)).toHaveBeenCalledWith(octokit)
    expect(jest.mocked(CommentUpserterImpl)).toHaveBeenCalledWith(octokitRest)

    expect(jest.mocked(Runner)).toHaveBeenCalledWith(
      jest.mocked(ConfigurationReaderImpl).mock.instances[0],
      jest.mocked(FilesChangedReaderImpl).mock.instances[0],
      jest.mocked(CommentUpserterImpl).mock.instances[0],
    )

    expect(jest.mocked(Runner).mock.instances[0].run).toHaveBeenCalledWith(
      github.context,
    )
    expect(jest.mocked(core).setFailed).not.toHaveBeenCalled()
  })

  describe('when an error is thrown', () => {
    it('sets the action status to failed', async () => {
      jest.mocked(core).getInput.mockImplementation(input => {
        throw new Error('getInput error')
      })
      await run()
      expect(jest.mocked(core).setFailed).toHaveBeenCalledWith(
        'Error: getInput error',
      )
    })
  })
})
