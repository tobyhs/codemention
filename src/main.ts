import * as core from '@actions/core'
import * as github from '@actions/github'

import {CommentUpserterImpl} from './comment-upserter'
import {ConfigurationReaderImpl} from './configuration-reader'
import {FilesChangedReaderImpl} from './files-changed-reader'
import Runner from './runner'

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('githubToken')
    const octokit = github.getOctokit(githubToken)
    const octokitRest = octokit.rest

    const configurationReader = new ConfigurationReaderImpl(octokitRest)
    const filesChangedReader = new FilesChangedReaderImpl(octokit)
    const commentUpserter = new CommentUpserterImpl(octokitRest)
    const runner = new Runner(
      configurationReader,
      filesChangedReader,
      commentUpserter,
    )
    runner.run(github.context)
  } catch (error) {
    core.setFailed(`${error}`)
  }
}
