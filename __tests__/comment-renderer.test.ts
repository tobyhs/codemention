import {beforeEach, describe, expect, it} from '@jest/globals'
import dedent from 'dedent'

import {CommentRendererImpl} from '../src/comment-renderer'

describe('CommentRendererImpl', () => {
  let renderer: CommentRendererImpl

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
  })
})
