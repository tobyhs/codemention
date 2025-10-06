import {beforeEach, describe, expect, it} from '@jest/globals'
import {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.d'
import {MockProxy, mockDeep} from 'jest-mock-extended'

import {FOOTER} from '../src/comment-renderer'
import {CommentUpserterImpl} from '../src/comment-upserter'
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
    const comment = `Test Comment\n${FOOTER}`

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
          await upserter.upsert(repo, pullNumber, [], comment)
          expect(issuesMock.createComment).toHaveBeenCalledTimes(0)
          expect(issuesMock.updateComment).toHaveBeenCalledTimes(0)
        })
      })

      describe('and there are matching rules', () => {
        it('creates a comment', async () => {
          await upserter.upsert(repo, pullNumber, rules, comment)

          expect(issuesMock.createComment).toHaveBeenCalledWith({
            ...repo,
            issue_number: pullNumber,
            body: comment,
          })
        })
      })
    })

    describe('when a codemention comment exists', () => {
      describe('and the comment is different', () => {
        describe('and the comment has the sentinel at the start', () => {
          it('updates the comment', async () => {
            // previous version of the action put the sentinel comment at the start
            const existingComment = `${FOOTER}\nExisting comment`
            stubListComments(['First', existingComment])

            await upserter.upsert(repo, pullNumber, rules, comment)

            expect(issuesMock.updateComment).toHaveBeenCalledWith({
              ...repo,
              comment_id: 2,
              body: comment,
            })
          })
        })

        describe('and the comment has the sentinel at the end', () => {
          it('updates the comment', async () => {
            const existingComment = `Existing Comment\n${FOOTER}`
            stubListComments(['First', existingComment])

            await upserter.upsert(repo, pullNumber, rules, comment)

            expect(issuesMock.updateComment).toHaveBeenCalledWith({
              ...repo,
              comment_id: 2,
              body: comment,
            })
          })
        })
      })

      describe('and the comment is the same', () => {
        it('does not update the comment', async () => {
          stubListComments(['First', comment])
          await upserter.upsert(repo, pullNumber, rules, comment)

          expect(issuesMock.updateComment).toHaveBeenCalledTimes(0)
        })
      })
    })
  })
})
