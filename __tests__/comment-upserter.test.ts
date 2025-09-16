import {beforeEach, describe, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import dedent from 'dedent'
import {EqualMatchingInjectorConfig, It, Mock, Times} from 'moq.ts'

import {
  CommentUpserterImpl,
  DEFAULT_COMMENT_PREAMBLE,
  FOOTER,
} from '../src/comment-upserter'
import {Repo} from '../src/github-types'

describe('CommentUpserterImpl', () => {
  let issuesMock: Mock<RestEndpointMethods['issues']>
  let upserter: CommentUpserterImpl

  beforeEach(() => {
    issuesMock = new Mock<RestEndpointMethods['issues']>({
      injectorConfig: new EqualMatchingInjectorConfig(),
    })
    const octokitRestMock = new Mock<RestEndpointMethods>()
      .setup(instance => instance.issues)
      .returns(issuesMock.object())
    upserter = new CommentUpserterImpl(octokitRestMock.object())
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

      issuesMock
        .setup(instance =>
          instance.listComments({...repo, issue_number: pullNumber}),
        )
        .returnsAsync(listResponse)
    }

    describe('when a codemention comment does not exist', () => {
      beforeEach(() => {
        stubListComments(['First', 'Second'])
      })

      describe('and there are no applicable mention rules', () => {
        it('does not insert or update a comment', async () => {
          await upserter.upsert(repo, pullNumber, [])
          issuesMock.verify(
            instance => instance.createComment(It.IsAny()),
            Times.Never(),
          )
          issuesMock.verify(
            instance => instance.updateComment(It.IsAny()),
            Times.Never(),
          )
        })
      })

      describe('and there are matching rules', () => {
        beforeEach(() => {
          issuesMock
            .setup(instance => instance.createComment(It.IsAny()))
            .returnsAsync(
              new Mock<
                RestEndpointMethodTypes['issues']['createComment']['response']
              >().object(),
            )
        })

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

          issuesMock.verify(instance =>
            instance.createComment({
              ...repo,
              issue_number: pullNumber,
              body: expectedCommentBody,
            }),
          )
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

          issuesMock.verify(instance =>
            instance.createComment({
              ...repo,
              issue_number: pullNumber,
              body: expectedCommentBody,
            }),
          )
        })

        it('creates a comment with a custom template', async () => {
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

          issuesMock.verify(instance =>
            instance.createComment({
              ...repo,
              issue_number: pullNumber,
              body: expectedCommentBody,
            }),
          )
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

            issuesMock
              .setup(instance => instance.updateComment(It.IsAny()))
              .returnsAsync(
                new Mock<
                  RestEndpointMethodTypes['issues']['updateComment']['response']
                >().object(),
              )

            await upserter.upsert(repo, pullNumber, rules)

            issuesMock.verify(instance =>
              instance.updateComment({
                ...repo,
                comment_id: 2,
                body: expectedCommentBody,
              }),
            )
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

            issuesMock
              .setup(instance => instance.updateComment(It.IsAny()))
              .returnsAsync(
                new Mock<
                  RestEndpointMethodTypes['issues']['updateComment']['response']
                >().object(),
              )

            await upserter.upsert(repo, pullNumber, rules)

            issuesMock.verify(instance =>
              instance.updateComment({
                ...repo,
                comment_id: 2,
                body: expectedCommentBody,
              }),
            )
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

          issuesMock.verify(
            instance => instance.updateComment(It.IsAny()),
            Times.Never(),
          )
        })
      })
    })
  })
})
