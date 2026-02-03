import * as core from '@actions/core'
import {Api} from '@octokit/plugin-rest-endpoint-methods'

import {FOOTER} from './comment-renderer'
import {Repo} from './github-types'
import {MatchedRule} from './template-types'

/**
 * @see {@link upsert}
 */
export interface CommentUpserter {
  /**
   * Inserts or updates a pull request comment that mentions users/teams.
   *
   * @param repo - repository that the pull request is in
   * @param pullNumber - number that identifies the pull request
   * @param rules - mention rules to use in the comment
   * @param comment - comment to insert/update
   */
  upsert(
    repo: Repo,
    pullNumber: number,
    rules: MatchedRule[],
    comment: string,
  ): Promise<void>
}

export class CommentUpserterImpl implements CommentUpserter {
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: Api['rest']) {}

  /** @override */
  async upsert(
    repo: Repo,
    pullNumber: number,
    rules: MatchedRule[],
    comment: string,
  ): Promise<void> {
    const issuesApi = this.octokitRest.issues
    const listResponse = await issuesApi.listComments({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pullNumber,
    })
    const existingComment = listResponse.data.find(
      c =>
        c.body !== undefined &&
        // keep backwards compatibility with existing comments that have the comment first
        (c.body.startsWith(FOOTER) || c.body.endsWith(FOOTER)),
    )
    if (existingComment === undefined) {
      if (rules.length > 0) {
        core.info('Creating a pull request comment')
        await issuesApi.createComment({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: pullNumber,
          body: comment,
        })
      } else {
        core.info('Not creating a pull request comment. No rules matched.')
      }
    } else if (existingComment.body !== comment) {
      core.info('Updating pull request comment')
      await issuesApi.updateComment({
        owner: repo.owner,
        repo: repo.repo,
        comment_id: existingComment.id,
        body: comment,
      })
    } else {
      core.info('Not updating pull request comment. Comment body matched.')
    }
  }
}
