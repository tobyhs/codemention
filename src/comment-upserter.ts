import * as core from '@actions/core'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import Handlebars, {HelperOptions} from 'handlebars'
import markdownEscape from 'markdown-escape'

import {CommentConfiguration, MentionRule} from './configuration'
import {Repo} from './github-types'

export const FOOTER = '<!-- codemention header -->'

export const DEFAULT_COMMENT_PREAMBLE =
  '[CodeMention](https://github.com/tobyhs/codemention):'

const HANDLEBARS_HELPERS = {
  markdownEscape(options: HelperOptions): string {
    return markdownEscape(options.fn(this), ['slashes'])
  }
}

const DEFAULT_TEMPLATE = `{{preamble}}
| File Patterns | Mentions |
| - | - |
{{#each matchedRules}}
| {{#each patterns}}{{#markdownEscape}}{{this}}{{/markdownEscape}}{{#unless @last}}<br>{{/unless}}{{/each}} | {{#each mentions}}@{{this}}{{#unless @last}}, {{/unless}}{{/each}} |
{{/each}}

{{#if epilogue}}
{{epilogue}}
{{/if}}
`

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
   * @param commentConfiguration - comment configuration for the upserted comment
   */
  upsert(
    repo: Repo,
    pullNumber: number,
    rules: MentionRule[],
    commentConfiguration?: CommentConfiguration
  ): Promise<void>
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
    rules: MentionRule[],
    commentConfiguration?: CommentConfiguration
  ): Promise<void> {
    const issuesApi = this.octokitRest.issues
    const listResponse = await issuesApi.listComments({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: pullNumber
    })
    const existingComment = listResponse.data.find(
      c =>
        c.body !== undefined &&
        // keep backwards compatibility with existing comments that have the comment first
        (c.body.startsWith(FOOTER) || c.body.endsWith(FOOTER))
    )
    const commentBody = this.createCommentBody(rules, commentConfiguration)

    if (existingComment === undefined) {
      if (rules.length > 0) {
        core.info('Creating a pull request comment')
        await issuesApi.createComment({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: pullNumber,
          body: commentBody
        })
      } else {
        core.info('Not creating a pull request comment. No rules matched.')
      }
    } else if (existingComment.body !== commentBody) {
      core.info('Updating pull request comment')
      await issuesApi.updateComment({
        owner: repo.owner,
        repo: repo.repo,
        comment_id: existingComment.id,
        body: commentBody
      })
    } else {
      core.info('Not updating pull request comment. Comment body matched.')
    }
  }

  /**
   * @param rules - mention rules to use in the comment
   * @param commentConfiguration - comment configuration for the upserted comment
   * @returns text to be used in a GitHub pull request comment body
   */
  private createCommentBody(
    rules: MentionRule[],
    commentConfiguration?: CommentConfiguration
  ): string {
    const template = commentConfiguration?.template ?? DEFAULT_TEMPLATE
    const comment = Handlebars.compile(template, {noEscape: true})(
      {
        matchedRules: rules,
        preamble: commentConfiguration?.preamble ?? DEFAULT_COMMENT_PREAMBLE,
        epilogue: commentConfiguration?.epilogue
      },
      {helpers: HANDLEBARS_HELPERS}
    )
    return `${comment}${FOOTER}`
  }
}
