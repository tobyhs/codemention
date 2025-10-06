import Handlebars from 'handlebars'
import markdownEscape from 'markdown-escape'

import {CommentConfiguration} from './configuration'
import {MatchedRule, Mention, TemplateContext} from './template-types'

export const FOOTER = '<!-- codemention header -->'

const DEFAULT_COMMENT_PREAMBLE =
  '[CodeMention](https://github.com/tobyhs/codemention):'

const HANDLEBARS_HELPERS = {
  markdownEscape(text: string): string {
    return markdownEscape(text, ['slashes'])
  },
}

const DEFAULT_TEMPLATE = `{{preamble}}
| File Patterns | Mentions |
| - | - |
{{#each matchedRules}}
| {{#each patterns}}{{markdownEscape this}}{{#unless @last}}<br>{{/unless}}{{/each}} | {{#each mentions}}@{{this}}{{#unless @last}}, {{/unless}}{{/each}} |
{{/each}}

{{#if epilogue}}
{{epilogue}}
{{/if}}
`

/**
 * @see {@link render}
 */
export interface CommentRenderer {
  /**
   * Renders the pull request comment body
   *
   * @param rules - matched mention rules to use in the comment
   * @param commentConfiguration - comment configuration for the upserted comment
   * @returns text to be used in a GitHub pull request comment body
   */
  render(
    rules: MatchedRule[],
    commentConfiguration?: CommentConfiguration,
  ): string
}

export class CommentRendererImpl implements CommentRenderer {
  /** @override */
  render(
    rules: MatchedRule[],
    commentConfiguration?: CommentConfiguration,
  ): string {
    const template = commentConfiguration?.template ?? DEFAULT_TEMPLATE
    const context: TemplateContext = {
      matchedRules: rules,
      mentions: this.createMentionsList(rules),
      preamble: commentConfiguration?.preamble ?? DEFAULT_COMMENT_PREAMBLE,
      epilogue: commentConfiguration?.epilogue,
    }
    const comment = Handlebars.compile(template, {noEscape: true})(context, {
      helpers: HANDLEBARS_HELPERS,
    })
    return `${comment}${FOOTER}`
  }

  private createMentionsList(rules: MatchedRule[]): Mention[] {
    const namesToFiles = new Map<string, Set<string>>()
    for (const rule of rules) {
      for (const name of rule.mentions) {
        let fileSet = namesToFiles.get(name)
        if (!fileSet) {
          fileSet = new Set<string>()
          namesToFiles.set(name, fileSet)
        }
        for (const file of rule.matchedFiles) {
          fileSet.add(file)
        }
      }
    }
    const mentions: Mention[] = []
    for (const [name, fileSet] of namesToFiles) {
      mentions.push({name, matchedFiles: [...fileSet].sort()})
    }
    return mentions.sort((a, b) => a.name.localeCompare(b.name))
  }
}
