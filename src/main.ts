import * as core from '@actions/core'
import * as github from '@actions/github'

import {CommentUpserterImpl} from './comment-upserter'
import {
  CodementionCodeownersLikeFormatFileConfigurationReaderImpl,
  CodementionYamlConfigurationReaderImpl
} from './configuration-reader'
import {FilesChangedReaderImpl} from './files-changed-reader'
import Runner from './runner'

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('githubToken')
    const configFileType = core.getInput('configFileType')
    if (!['yaml', 'codeowners-like'].includes(configFileType)) {
      throw new Error(
        'Invalid configFileType. Must be either "yaml" or "codeowners-like"'
      )
    }

    const octokit = github.getOctokit(githubToken)
    const octokitRest = octokit.rest

    const configurationReader =
      configFileType === 'yaml'
        ? new CodementionYamlConfigurationReaderImpl(octokitRest)
        : new CodementionCodeownersLikeFormatFileConfigurationReaderImpl(
            octokitRest
          )
    const filesChangedReader = new FilesChangedReaderImpl(octokit)
    const commentUpserter = new CommentUpserterImpl(octokitRest)
    const runner = new Runner(
      configurationReader,
      filesChangedReader,
      commentUpserter
    )
    runner.run(github.context)
  } catch (error) {
    core.setFailed(`${error}`)
  }
}
