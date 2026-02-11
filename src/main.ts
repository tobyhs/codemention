import * as core from '@actions/core'
import * as github from '@actions/github'

import {CommentRendererImpl} from './comment-renderer.js'
import {CommentUpserterImpl} from './comment-upserter.js'
import {ConfigurationReaderImpl} from './configuration-reader.js'
import {FilesChangedReaderImpl} from './files-changed-reader.js'
import Runner from './runner.js'

export async function run(): Promise<void> {
  try {
    const githubToken = core.getInput('githubToken')
    const octokit = github.getOctokit(githubToken)
    const octokitRest = octokit.rest

    const configurationReader = new ConfigurationReaderImpl(octokitRest)
    const filesChangedReader = new FilesChangedReaderImpl(octokit)
    const commentRenderer = new CommentRendererImpl()
    const commentUpserter = new CommentUpserterImpl(octokitRest)
    const runner = new Runner(
      configurationReader,
      filesChangedReader,
      commentRenderer,
      commentUpserter,
    )
    runner.run(github.context)
  } catch (error) {
    core.setFailed(`${error}`)
  }
}
