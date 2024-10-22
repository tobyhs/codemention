import {beforeEach, describe, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import {EqualMatchingInjectorConfig, It, Mock, Times} from 'moq.ts'

import {
  CommentUpserterImpl,
  DEFAULT_COMMENT_PREAMBLE,
  FOOTER
} from '../src/comment-upserter'
import {Repo} from '../src/github-types'

describe('CommentUpserterImpl', () => {
  let issuesMock: Mock<RestEndpointMethods['issues']>
  let upserter: CommentUpserterImpl

  beforeEach(() => {
    issuesMock = new Mock<RestEndpointMethods['issues']>({
      injectorConfig: new EqualMatchingInjectorConfig()
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
        mentions: ['cto', 'dba']
      },
      {
        patterns: ['.github/**', 'spec/*.rb'],
        mentions: ['ci']
      }
    ]

    const stubListComments = (comments: string[]): void => {
      const listResponse = {
        data: comments.map((comment, index) => ({id: index + 1, body: comment}))
      } as RestEndpointMethodTypes['issues']['listComments']['response']

      issuesMock
        .setup(instance =>
          instance.listComments({...repo, issue_number: pullNumber})
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
            Times.Never()
          )
          issuesMock.verify(
            instance => instance.updateComment(It.IsAny()),
            Times.Never()
          )
        })
      })

      it('creates a comment', async () => {
        const expectedCommentBody = [
          DEFAULT_COMMENT_PREAMBLE,
          '| File Patterns | Mentions |',
          '| - | - |',
          '| db/migrate/\\*\\* | @cto, @dba |',
          '| .github/\\*\\*<br>spec/\\*.rb | @ci |',
          '',
          FOOTER
        ].join('\n')

        issuesMock
          .setup(instance => instance.createComment(It.IsAny()))
          .returnsAsync(
            new Mock<
              RestEndpointMethodTypes['issues']['createComment']['response']
            >().object()
          )

        await upserter.upsert(repo, pullNumber, rules)

        issuesMock.verify(instance =>
          instance.createComment({
            ...repo,
            issue_number: pullNumber,
            body: expectedCommentBody
          })
        )
      })

      it('creates a comment with custom comment content', async () => {
        const customContent = {
          preamble: 'Added you as a subscriber.',
          epilogue: '> [CodeMention](https://github.com/tobyhs/codemention)'
        }
        const expectedCommentBody = [
          customContent.preamble,
          '| File Patterns | Mentions |',
          '| - | - |',
          '| db/migrate/\\*\\* | @cto, @dba |',
          '| .github/\\*\\*<br>spec/\\*.rb | @ci |',
          '',
          customContent.epilogue,
          FOOTER
        ].join('\n')

        issuesMock
          .setup(instance => instance.createComment(It.IsAny()))
          .returnsAsync(
            new Mock<
              RestEndpointMethodTypes['issues']['createComment']['response']
            >().object()
          )

        await upserter.upsert(repo, pullNumber, rules, customContent)

        issuesMock.verify(instance =>
          instance.createComment({
            ...repo,
            issue_number: pullNumber,
            body: expectedCommentBody
          })
        )
      })
    })

    describe('when a codemention comment exists', () => {
      describe('and the comment is different', () => {
        describe('and the comment has the sentinel at the start', () => {
          it('updates the comment', async () => {
            const expectedCommentBody = [
              DEFAULT_COMMENT_PREAMBLE,
              '| File Patterns | Mentions |',
              '| - | - |',
              '| db/migrate/\\*\\* | @cto, @dba |',
              '| .github/\\*\\*<br>spec/\\*.rb | @ci |',
              '',
              FOOTER
            ].join('\n')

            // previous version of the action put the sentinel comment at the start
            const existingComment =
              FOOTER + '| config/brakeman.yml | @security |'
            stubListComments(['First', existingComment])

            issuesMock
              .setup(instance => instance.updateComment(It.IsAny()))
              .returnsAsync(
                new Mock<
                  RestEndpointMethodTypes['issues']['updateComment']['response']
                >().object()
              )

            await upserter.upsert(repo, pullNumber, rules)

            issuesMock.verify(instance =>
              instance.updateComment({
                ...repo,
                comment_id: 2,
                body: expectedCommentBody
              })
            )
          })
        })

        describe('and the comment has the sentinel at the end', () => {
          it('updates the comment', async () => {
            const expectedCommentBody = [
              DEFAULT_COMMENT_PREAMBLE,
              '| File Patterns | Mentions |',
              '| - | - |',
              '| db/migrate/\\*\\* | @cto, @dba |',
              '| .github/\\*\\*<br>spec/\\*.rb | @ci |',
              '',
              FOOTER
            ].join('\n')

            const existingComment =
              '| config/brakeman.yml | @security |' + FOOTER
            stubListComments(['First', existingComment])

            issuesMock
              .setup(instance => instance.updateComment(It.IsAny()))
              .returnsAsync(
                new Mock<
                  RestEndpointMethodTypes['issues']['updateComment']['response']
                >().object()
              )

            await upserter.upsert(repo, pullNumber, rules)

            issuesMock.verify(instance =>
              instance.updateComment({
                ...repo,
                comment_id: 2,
                body: expectedCommentBody
              })
            )
          })
        })
      })

      describe('and the comment is the same', () => {
        it('does not update the comment', async () => {
          const commentBody = [
            DEFAULT_COMMENT_PREAMBLE,
            '| File Patterns | Mentions |',
            '| - | - |',
            '| db/migrate/\\*\\* | @cto, @dba |',
            '| .github/\\*\\*<br>spec/\\*.rb | @ci |',
            '',
            FOOTER
          ].join('\n')

          stubListComments(['First', commentBody])
          await upserter.upsert(repo, pullNumber, rules)

          issuesMock.verify(
            instance => instance.updateComment(It.IsAny()),
            Times.Never()
          )
        })
      })
    })
  })
})
