import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import dedent from 'dedent'

import * as core from './moduleMocks/core'
jest.unstable_mockModule('@actions/core', () => core)

import {CommentRenderer} from '../src/comment-renderer'
const {CommentRendererImpl} = await import('../src/comment-renderer')

describe('CommentRendererImpl', () => {
  let renderer: CommentRenderer

  beforeEach(() => {
    renderer = new CommentRendererImpl()
  })

  describe('.render', () => {
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

    it('renders the default template', () => {
      const expectedComment = dedent`
        [CodeMention](https://github.com/tobyhs/codemention):
        | File Patterns | Mentions |
        | - | - |
        | db/migrate/\*\* | @cto, @dba |
        | .github/\*\*<br>spec/\*.rb | @ci |

        <!-- codemention header -->
      `

      expect(renderer.render(rules)).toBe(expectedComment)
    })

    it('renders a comment with preamble and epilogue', () => {
      const commentConfiguration = {
        preamble: 'Added you as a subscriber.',
        epilogue: '> [CodeMention](https://github.com/tobyhs/codemention)',
      }
      const expectedComment = dedent`
        Added you as a subscriber.
        | File Patterns | Mentions |
        | - | - |
        | db/migrate/\*\* | @cto, @dba |
        | .github/\*\*<br>spec/\*.rb | @ci |

        > [CodeMention](https://github.com/tobyhs/codemention)

        Warning: The preamble and epilogue options in commentConfiguration are deprecated. Use template instead.
        <!-- codemention header -->
      `

      expect(renderer.render(rules, commentConfiguration)).toBe(expectedComment)
    })

    it('renders a comment with a custom template with matchedRules', () => {
      const template = dedent`
        # CodeMention
        {{#each matchedRules}}
        {{#each mentions}}@{{this}}{{#unless @last}}, {{/unless}}{{/each}} ({{#each patterns}}{{markdownEscape this}}{{#unless @last}}, {{/unless}}{{/each}}):
        {{#each matchedFiles}}{{markdownEscape this}}{{#unless @last}}, {{/unless}}{{/each}}

        {{/each}}
      `
      const expectedComment = dedent`
        # CodeMention
        @cto, @dba (db/migrate/\*\*):
        db/migrate/20250913000000\_test.rb

        @ci (.github/\*\*, spec/\*.rb):
        .github/codemention.yml, spec/spec\_helper.rb

        <!-- codemention header -->
      `

      expect(renderer.render(rules, {template})).toBe(expectedComment)
    })

    it('renders a comment with a custom template with mentions', () => {
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
      const expectedComment = dedent`
        @ci: .github/codemention.yml, spec/spec\_helper.rb
        @cto: config/environments/production.rb, db/migrate/20250913000000\_test.rb
        @dba: db/migrate/20250913000000\_test.rb
        @infra: config/environments/production.rb
        <!-- codemention header -->
      `

      expect(renderer.render(rules, {template})).toBe(expectedComment)
    })

    it.each(['preamble', 'epilogue'])(
      'logs a warning when using the %s option',
      option => {
        renderer.render(rules, {[option]: 'Testing'})
        expect(core.warning).toHaveBeenCalledWith(
          'The preamble and epilogue options in commentConfiguration are deprecated. Use template instead.',
        )
      },
    )

    it('does not log a warning when preamble or epilogue is not provided', () => {
      renderer.render(rules, {})
      expect(core.warning).toHaveBeenCalledTimes(0)
    })
  })
})
