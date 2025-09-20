import {Context} from '@actions/github/lib/context'
import {beforeEach, describe, expect, it} from '@jest/globals'
import {PullRequest} from '@octokit/webhooks-types/schema.d'
import * as fs from 'fs'
import {MockProxy, mock} from 'jest-mock-extended'
import * as yaml from 'js-yaml'
import * as path from 'path'

import {CommentUpserter} from '../src/comment-upserter'
import {Configuration} from '../src/configuration'
import {ConfigurationReader} from '../src/configuration-reader'
import {FilesChangedReader} from '../src/files-changed-reader'
import {Repo} from '../src/github-types'
import Runner from '../src/runner'

describe('Runner', () => {
  let configurationReader: MockProxy<ConfigurationReader>
  let filesChangedReader: MockProxy<FilesChangedReader>
  let commentUpserter: MockProxy<CommentUpserter>
  let runner: Runner

  let repo: Repo
  let context: Context
  const prNumber = 123
  const baseSha = 'bfc5b2d29cfa2db8ce40f6c60bc9629490fe1225'
  let pullRequest: PullRequest
  const configuration: Configuration = yaml.load(
    fs.readFileSync(
      path.join(__dirname, 'fixtures', 'codemention.yml'),
      'utf8',
    ),
  ) as Configuration

  beforeEach(() => {
    repo = {owner: 'tobyhs', repo: 'codemention'}
    pullRequest = {
      number: prNumber,
      base: {sha: baseSha},
      draft: false,
      user: {
        login: 'testlogin',
      },
    } as PullRequest
    context = {
      repo,
      payload: {pull_request: pullRequest},
    } as unknown as Context

    configurationReader = mock<ConfigurationReader>()
    configurationReader.read
      .calledWith(repo, baseSha)
      .mockResolvedValue(configuration)

    const filesChanged = [
      'config/.env.production',
      '.github/workflows/codemention.yml',
    ]
    filesChangedReader = mock<FilesChangedReader>()
    filesChangedReader.read
      .calledWith(repo, prNumber)
      .mockResolvedValue(filesChanged)

    commentUpserter = mock<CommentUpserter>()

    runner = new Runner(
      configurationReader,
      filesChangedReader,
      commentUpserter,
    )
  })

  describe('.run', () => {
    describe('when the pull request is a draft', () => {
      it('does not upsert a comment', async () => {
        pullRequest.draft = true
        await runner.run(context)
        expect(commentUpserter.upsert).toHaveBeenCalledTimes(0)
      })
    })

    it('runs main logic of the GitHub action', async () => {
      await runner.run(context)
      const matchedRules = [
        {
          patterns: ['config/**'],
          mentions: ['sysadmin'],
          matchedFiles: ['config/.env.production'],
        },
        {
          patterns: ['.github/**', 'spec/*.rb'],
          mentions: ['ci'],
          matchedFiles: ['.github/workflows/codemention.yml'],
        },
      ]
      expect(commentUpserter.upsert).toHaveBeenCalledWith(
        repo,
        prNumber,
        matchedRules,
        {preamble: 'testing preamble', epilogue: 'testing epilogue'},
      )
    })
  })
})
