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
 * Configuration for the GitHub Action
 */
export interface Configuration {
  /** Rules for mentioning */
  rules: MentionRule[]
}
