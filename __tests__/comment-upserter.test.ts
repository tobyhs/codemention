import {beforeEach, describe, expect, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import dedent from 'dedent'
import {MockProxy, mockDeep} from 'jest-mock-extended'

import {
  CommentUpserterImpl,
  DEFAULT_COMMENT_PREAMBLE,
  FOOTER,
} from '../src/comment-upserter'
import {Repo} from '../src/github-types'
import {deepEqualsMatch} from './matchers'

describe('CommentUpserterImpl', () => {
  let issuesMock: MockProxy<RestEndpointMethods['issues']>
  let upserter: CommentUpserterImpl

  beforeEach(() => {
    const octokitRestMock = mockDeep<RestEndpointMethods>()
    issuesMock = octokitRestMock.issues
    upserter = new CommentUpserterImpl(octokitRestMock)
  })

  describe('.upsert', () => {
    const repo: Repo = {owner: 'tobyhs', repo: 'codemention'}
    const pullNumber = 17

    const rules = [
      {
        patterns: ['db/migrate/**'],
        mentions: ['cto', 'dba'],
        matchedFiles: ['db/migrate/20250913000000_test.rb'],
      },
      {
        patterns: ['.github/**', 'spec/*.rb'],
        mentions: ['ci'],
        matchedFiles: ['.github/codemention.yml', 'spec/spec_helper.rb'],
      },
    ]

    const stubListComments = (comments: string[]): void => {
      const listResponse = {
        data: comments.map((comment, index) => ({
          id: index + 1,
          body: comment,
        })),
      } as RestEndpointMethodTypes['issues']['listComments']['response']

      issuesMock.listComments
        .calledWith(deepEqualsMatch({...repo, issue_number: pullNumber}))
        .mockResolvedValue(listResponse)
    }

    describe('when a codemention comment does not exist', () => {
      beforeEach(() => {
        stubListComments(['First', 'Second'])
      })

      describe('and there are no applicable mention rules', () => {
        it('does not insert or update a comment', async () => {
          await upserter.upsert(repo, pullNumber, [])
          expect(issuesMock.createComment).toHaveBeenCalledTimes(0)
          expect(issuesMock.updateComment).toHaveBeenCalledTimes(0)
        })
      })

      describe('and there are matching rules', () => {
        it('creates a comment', async () => {
          const expectedCommentBody = dedent`
            ${DEFAULT_COMMENT_PREAMBLE}
            | File Patterns | Mentions |
            | - | - |
            | db/migrate/\*\* | @cto, @dba |
            | .github/\*\*<br>spec/\*.rb | @ci |

            ${FOOTER}
          `

          await upserter.upsert(repo, pullNumber, rules)

          expect(issuesMock.createComment).toHaveBeenCalledWith({
            ...repo,
            issue_number: pullNumber,
            body: expectedCommentBody,
          })
        })

        it('creates a comment with custom comment content', async () => {
          const customContent = {
            preamble: 'Added you as a subscriber.',
            epilogue: '> [CodeMention](https://github.com/tobyhs/codemention)',
          }
          const expectedCommentBody = dedent`
            ${customContent.preamble}
            | File Patterns | Mentions |
            | - | - |
            | db/migrate/\*\* | @cto, @dba |
            | .github/\*\*<br>spec/\*.rb | @ci |

            ${customContent.epilogue}
            ${FOOTER}
          `

          await upserter.upsert(repo, pullNumber, rules, customContent)

          expect(issuesMock.createComment).toHaveBeenCalledWith({
            ...repo,
            issue_number: pullNumber,
            body: expectedCommentBody,
          })
        })

        it('creates a comment with a custom template with matchedRules', async () => {
          const template = dedent`
            # CodeMention
            {{#each matchedRules}}
            {{#each mentions}}@{{this}}{{#unless @last}}, {{/unless}}{{/each}} ({{#each patterns}}{{markdownEscape this}}{{#unless @last}}, {{/unless}}{{/each}}):
            {{#each matchedFiles}}{{markdownEscape this}}{{#unless @last}}, {{/unless}}{{/each}}

            {{/each}}
          `
          const expectedCommentBody = dedent`
            # CodeMention
            @cto, @dba (db/migrate/\*\*):
            db/migrate/20250913000000\_test.rb

            @ci (.github/\*\*, spec/\*.rb):
            .github/codemention.yml, spec/spec\_helper.rb

            ${FOOTER}
          `

          await upserter.upsert(repo, pullNumber, rules, {template})

          expect(issuesMock.createComment).toHaveBeenCalledWith({
            ...repo,
            issue_number: pullNumber,
            body: expectedCommentBody,
          })
        })

        it('creates a comment with a custom template with mentions', async () => {
          const rules = [
            {
              patterns: ['db/migrate/**'],
              mentions: ['cto', 'dba'],
              matchedFiles: ['db/migrate/20250913000000_test.rb'],
            },
            {
              patterns: ['.github/**', 'spec/*.rb'],
              mentions: ['ci'],
              matchedFiles: ['.github/codemention.yml', 'spec/spec_helper.rb'],
            },
            {
              patterns: ['config/environments/*.rb'],
              mentions: ['infra', 'cto'],
              matchedFiles: ['config/environments/production.rb'],
            },
          ]

          const template = dedent`
            {{#each mentions}}
            @{{name}}: {{#each matchedFiles}}{{markdownEscape this}}{{#unless @last}}, {{/unless}}{{/each}}
            {{/each}}
          `
          const expectedCommentBody = dedent`
            @ci: .github/codemention.yml, spec/spec\_helper.rb
            @cto: config/environments/production.rb, db/migrate/20250913000000\_test.rb
            @dba: db/migrate/20250913000000\_test.rb
            @infra: config/environments/production.rb
            ${FOOTER}
          `

          await upserter.upsert(repo, pullNumber, rules, {template})

          expect(issuesMock.createComment).toHaveBeenCalledWith({
            ...repo,
            issue_number: pullNumber,
            body: expectedCommentBody,
          })
        })
      })
    })

    describe('when a codemention comment exists', () => {
      describe('and the comment is different', () => {
        describe('and the comment has the sentinel at the start', () => {
          it('updates the comment', async () => {
            const expectedCommentBody = dedent`
              ${DEFAULT_COMMENT_PREAMBLE}
              | File Patterns | Mentions |
              | - | - |
              | db/migrate/\*\* | @cto, @dba |
              | .github/\*\*<br>spec/\*.rb | @ci |

              ${FOOTER}
            `

            // previous version of the action put the sentinel comment at the start
            const existingComment =
              FOOTER + '| config/brakeman.yml | @security |'
            stubListComments(['First', existingComment])

            await upserter.upsert(repo, pullNumber, rules)

            expect(issuesMock.updateComment).toHaveBeenCalledWith({
              ...repo,
              comment_id: 2,
              body: expectedCommentBody,
            })
          })
        })

        describe('and the comment has the sentinel at the end', () => {
          it('updates the comment', async () => {
            const expectedCommentBody = dedent`
              ${DEFAULT_COMMENT_PREAMBLE}
              | File Patterns | Mentions |
              | - | - |
              | db/migrate/\*\* | @cto, @dba |
              | .github/\*\*<br>spec/\*.rb | @ci |

              ${FOOTER}
            `

            const existingComment =
              '| config/brakeman.yml | @security |' + FOOTER
            stubListComments(['First', existingComment])

            await upserter.upsert(repo, pullNumber, rules)

            expect(issuesMock.updateComment).toHaveBeenCalledWith({
              ...repo,
              comment_id: 2,
              body: expectedCommentBody,
            })
          })
        })
      })

      describe('and the comment is the same', () => {
        it('does not update the comment', async () => {
          const commentBody = dedent`
            ${DEFAULT_COMMENT_PREAMBLE}
            | File Patterns | Mentions |
            | - | - |
            | db/migrate/\*\* | @cto, @dba |
            | .github/\*\*<br>spec/\*.rb | @ci |

            ${FOOTER}
          `

          stubListComments(['First', commentBody])
          await upserter.upsert(repo, pullNumber, rules)

          expect(issuesMock.updateComment).toHaveBeenCalledTimes(0)
        })
      })
    })
  })
})
