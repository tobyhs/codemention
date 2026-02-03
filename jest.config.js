export default {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.[jt]s$': 'ts-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!(@octokit|before-after-hook|universal-user-agent)/)'],
  verbose: true,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
}
