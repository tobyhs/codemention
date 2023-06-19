import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'

import {MentionRule} from './configuration'
import {Repo} from './github-types'

export const HEADER = [
  '<!-- codemention header -->',
  '[CodeMention](https://github.com/tobyhs/codemention):\n',
  '| File Patterns | Mentions |',
  '| - | - |\n'
].join('\n')

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
   */
  upsert(repo: Repo, pullNumber: number, rules: MentionRule[]): Promise<void>
}

export class CommentUpserterImpl implements CommentUpserter {
  /**
   * @param octokitRest - GitHub REST API client
   */
  constructor(private readonly octokitRest: RestEndpointMethods) {}

  /** @override */
  async upsert(
    repo: Repo,
    pullNumber: number,
    rules: MentionRule[]
  ): Promise<void> {
    const issuesApi = this.octokitRest.issues
    const listResponse = await issuesApi.listComments({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pullNumber
    })
    const existingComment = listResponse.data.find(
      c => c.body !== undefined && c.body.startsWith(HEADER)
    )
    const commentBody = this.createCommentBody(rules)

    if (existingComment === undefined) {
      if (rules.length > 0) {
        await issuesApi.createComment({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: pullNumber,
          body: commentBody
        })
      }
    } else if (existingComment.body !== commentBody) {
      await issuesApi.updateComment({
        owner: repo.owner,
        repo: repo.repo,
        comment_id: existingComment.id,
        body: commentBody
      })
    }
  }

  /**
   * @param rules - mention rules to use in the comment
   * @returns text to be used in a GitHub pull request comment body
   */
  private createCommentBody(rules: MentionRule[]): string {
    const body = rules
      .map(rule => {
        const patterns = rule.patterns.join('<br>')
        const mentions = rule.mentions.map(name => `@${name}`).join(', ')
        return `| ${patterns} | ${mentions} |`
      })
      .join('\n')
    return `${HEADER}${body}`
  }
}
