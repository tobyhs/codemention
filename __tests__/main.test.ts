import {GitHub} from '@actions/github/lib/utils'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {Api} from '@octokit/plugin-rest-endpoint-methods'
import {randomUUID} from 'crypto'
import {MockProxy, mock, mockDeep} from 'jest-mock-extended'

import * as core from './moduleMocks/core'
jest.unstable_mockModule('@actions/core', () => core)
import * as origGithub from '@actions/github'
const github = {
  getOctokit: jest.fn<typeof origGithub.getOctokit>(),
  context: mock<typeof origGithub.context>(),
}
jest.unstable_mockModule('@actions/github', () => github)

function mockModuleAndInstance<T, CP extends unknown[]>(
  modulePath: string,
  ctor: new (...args: CP) => T,
  exportName?: string,
): [typeof ctor, MockProxy<T>] {
  const instance = mock<T>()
  const ctorMock = jest.fn((..._args: CP) => instance)
  jest.unstable_mockModule(modulePath, () => ({
    [exportName ?? ctor.name]: ctorMock,
  }))
  return [ctorMock, instance]
}

import {CommentRendererImpl} from '../src/comment-renderer'
const [CommentRendererImplMock, commentRenderer] = mockModuleAndInstance(
  '../src/comment-renderer',
  CommentRendererImpl,
)

import {CommentUpserterImpl} from '../src/comment-upserter'
const [CommentUpserterImplMock, commentUpserter] = mockModuleAndInstance(
  '../src/comment-upserter',
  CommentUpserterImpl,
)

import {ConfigurationReaderImpl} from '../src/configuration-reader'
const [ConfigurationReaderImplMock, configurationReader] =
  mockModuleAndInstance('../src/configuration-reader', ConfigurationReaderImpl)

import {FilesChangedReaderImpl} from '../src/files-changed-reader'
const [FilesChangedReaderImplMock, filesChangedReader] = mockModuleAndInstance(
  '../src/files-changed-reader',
  FilesChangedReaderImpl,
)

import Runner from '../src/runner'
const [RunnerMock, runner] = mockModuleAndInstance(
  '../src/runner',
  Runner,
  'default',
)

const {run} = await import('../src/main')

describe('run', () => {
  const githubToken = randomUUID()
  let octokit: InstanceType<typeof GitHub>
  let octokitRest: Api['rest']

  beforeEach(() => {
    core.getInput.mockImplementation(input => {
      if (input === 'githubToken') {
        return githubToken
      } else {
        throw new Error(`Unexpected input: ${input}`)
      }
    })

    octokit = mockDeep<InstanceType<typeof GitHub>>()
    octokitRest = octokit.rest
    github.getOctokit.mockReturnValue(octokit)
  })

  it('calls Runner.run', async () => {
    await run()

    expect(github.getOctokit).toHaveBeenCalledWith(githubToken)
    expect(ConfigurationReaderImplMock).toHaveBeenCalledWith(octokitRest)
    expect(FilesChangedReaderImplMock).toHaveBeenCalledWith(octokit)
    expect(CommentRendererImplMock).toHaveBeenCalled()
    expect(CommentUpserterImplMock).toHaveBeenCalledWith(octokitRest)

    expect(RunnerMock).toHaveBeenCalledWith(
      configurationReader,
      filesChangedReader,
      commentRenderer,
      commentUpserter,
    )

    expect(runner.run).toHaveBeenCalledWith(github.context)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  describe('when an error is thrown', () => {
    it('sets the action status to failed', async () => {
      core.getInput.mockImplementation(() => {
        throw new Error('getInput error')
      })
      await run()
      expect(core.setFailed).toHaveBeenCalledWith('Error: getInput error')
    })
  })
})
