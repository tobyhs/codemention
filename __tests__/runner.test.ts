import {Context} from '@actions/github/lib/context'
import {beforeEach, describe, it} from '@jest/globals'
import {PullRequest} from '@octokit/webhooks-types/schema.d'
import * as fs from 'fs'
import * as yaml from 'js-yaml'
import {EqualMatchingInjectorConfig, It, Mock, Times} from 'moq.ts'
import * as path from 'path'

import {CommentUpserter} from '../src/comment-upserter'
import {Configuration} from '../src/configuration'
import {ConfigurationReader} from '../src/configuration-reader'
import {FilesChangedReader} from '../src/files-changed-reader'
import {Repo} from '../src/github-types'
import Runner from '../src/runner'

describe('Runner', () => {
  function setUpDependencies({
    draft,
    prNumber,
    baseSha,
    excludeAuthor
  }: {
    draft: boolean
    prNumber: number
    baseSha: string
    excludeAuthor?: boolean
  }) {
    const repo = {owner: 'tobyhs', repo: 'codemention'}
    const pullRequest = {
      number: prNumber,
      base: {sha: baseSha},
      draft,
      user: {
        login: 'testlogin'
      }
    } as PullRequest
    const context = {
      repo,
      payload: {pull_request: pullRequest}
    } as unknown as Context

    const configuration: Configuration = yaml.load(
      fs.readFileSync(
        path.join(__dirname, 'fixtures', 'codemention.yml'),
        'utf8'
      )
    ) as Configuration

    if (excludeAuthor) {
      configuration.excludeAuthor = true
    }

    const configurationReader = new Mock<ConfigurationReader>({
      injectorConfig: new EqualMatchingInjectorConfig()
    })
      .setup(async instance => instance.read(repo, baseSha))
      .returnsAsync(configuration)
      .object()

    const filesChanged = [
      'config/application.rb',
      '.github/workflows/codemention.yml'
    ]
    const filesChangedReader = new Mock<FilesChangedReader>({
      injectorConfig: new EqualMatchingInjectorConfig()
    })
      .setup(async instance => instance.read(repo, prNumber))
      .returnsAsync(filesChanged)
      .object()

    const commentUpserterMock = new Mock<CommentUpserter>({
      injectorConfig: new EqualMatchingInjectorConfig()
    })
    commentUpserterMock
      .setup(instance => instance.upsert(It.IsAny(), It.IsAny(), It.IsAny()))
      .returns(Promise.resolve())

    const runner = new Runner(
      configurationReader,
      filesChangedReader,
      commentUpserterMock.object()
    )

    return {repo, runner, context, commentUpserterMock}
  }

  describe('.run', () => {
    describe('when the pull request is a draft', () => {
      it('does not upsert a comment', async () => {
        const prNumber = 123
        const baseSha = 'bfc5b2d29cfa2db8ce40f6c60bc9629490fe1225'
        const {runner, context, commentUpserterMock} = setUpDependencies({
          draft: true,
          prNumber,
          baseSha
        })

        await runner.run(context)
        commentUpserterMock.verify(
          instance => instance.upsert(It.IsAny(), It.IsAny(), It.IsAny()),
          Times.Never()
        )
      })
    })

    it('runs main logic of the GitHub action', async () => {
      const prNumber = 123
      const baseSha = 'bfc5b2d29cfa2db8ce40f6c60bc9629490fe1225'
      const {repo, runner, context, commentUpserterMock} = setUpDependencies({
        draft: false,
        prNumber,
        baseSha
      })

      await runner.run(context)
      const matchingRules = [
        {
          patterns: ['config/**'],
          mentions: ['sysadmin', 'testlogin']
        },
        {
          patterns: ['.github/**', 'spec/*.rb'],
          mentions: ['ci']
        }
      ]
      commentUpserterMock.verify(instance =>
        instance.upsert(repo, prNumber, matchingRules, {
          preamble: 'testing preamble',
          epilogue: 'testing epilogue'
        })
      )
    })

    describe('when excludeAuthor configuration is specified', () => {
      it('does not include the author in the comment', async () => {
        const prNumber = 123
        const baseSha = 'bfc5b2d29cfa2db8ce40f6c60bc9629490fe1225'
        const {repo, runner, context, commentUpserterMock} = setUpDependencies({
          draft: false,
          prNumber,
          baseSha,
          excludeAuthor: true
        })

        await runner.run(context)
        const matchingRules = [
          {
            patterns: ['config/**'],
            mentions: ['sysadmin']
          },
          {
            patterns: ['.github/**', 'spec/*.rb'],
            mentions: ['ci']
          }
        ]
        commentUpserterMock.verify(instance =>
          instance.upsert(repo, prNumber, matchingRules, {
            preamble: 'testing preamble',
            epilogue: 'testing epilogue'
          })
        )
      })
    })
  })
})
