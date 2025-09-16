import {MentionRule} from './configuration'

/**
 * A MentionRule that was matched to some files changed in a pull request
 */
export interface MatchedRule extends MentionRule {
  /** the files that matched this rule */
  matchedFiles: string[]
}

/**
 * Variables that can be used in a comment template
 */
export interface TemplateContext {
  /** mention rules that matched files changed in a pull request */
  matchedRules: MatchedRule[]

  /** content to print above matching rules table */
  preamble: string | undefined

  /** content to print below matching rules table */
  epilogue: string | undefined
}
