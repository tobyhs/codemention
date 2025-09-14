/**
 * A rule that determines who to mention when files match
 */
export interface MentionRule {
  /** File patterns to match for the rule */
  patterns: string[]

  /** names of users or teams to mention (without the at sign) */
  mentions: string[]
}

/**
 * A set of configuration items for the comment posted by the bot
 */
export interface CommentConfiguration {
  /** Handlebars template for the pull request comment to create */
  template?: string
  /** Comment content to print above matching rules table */
  preamble?: string
  /** Comment content to print below matching rules table */
  epilogue?: string
}

/**
 * Configuration for the GitHub Action
 */
export interface Configuration {
  /** Rules for mentioning */
  rules: MentionRule[]
  /** Configuration for comment */
  commentConfiguration?: CommentConfiguration
}
