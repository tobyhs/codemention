import * as core from '@actions/core'
import {Context} from '@actions/github/lib/context'
import {PullRequestEvent} from '@octokit/webhooks-types/schema.d'
import micromatch from 'micromatch'

import {CommentUpserter} from './comment-upserter'
import {ConfigurationReader} from './configuration-reader'
import {FilesChangedReader} from './files-changed-reader'
import {MentionRule} from './configuration'

/**
 * @see {@link run}
 */
export default class Runner {
  /**
   * @param configurationReader - object to read a repo's codemention.yml file
   * @param filesChangedReader - object to retrieve files changed in a pull request
   * @param commentUpserter - object to upsert pull request comments
   */
  constructor(
    private readonly configurationReader: ConfigurationReader,
    private readonly filesChangedReader: FilesChangedReader,
    private readonly commentUpserter: CommentUpserter
  ) {}

  /**
   * Runs the main logic of the GitHub action
   *
   * @param context - context of the GitHub action
   */
  async run(context: Context): Promise<void> {
    const {repo} = context
    const event = context.payload as PullRequestEvent
    const pullRequest = event.pull_request
    if (pullRequest.draft) {
      core.debug('Skipping draft pull request')
      return
    }

    const [configuration, filesChanged] = await Promise.all([
      this.configurationReader.read(repo, pullRequest.base.sha),
      this.filesChangedReader.read(repo, pullRequest.number)
    ])

    // filter out the PR author so that they don't get double-notified
    const matchingRules = configuration.rules
      .filter(rule => micromatch(filesChanged, rule.patterns).length > 0)
      .map((rule: MentionRule) => ({
        ...rule,
        mentions: rule.mentions.filter(
          mention => mention !== pullRequest.user.login
        )
      }))
      .filter(rule => rule.mentions.length > 0)

    await this.commentUpserter.upsert(
      repo,
      pullRequest.number,
      matchingRules,
      configuration.commentConfiguration
    )
  }
}
