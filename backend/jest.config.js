module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: 'src',
    testRegex: '.*\\.spec\\.ts$',
    testPathIgnorePatterns: [
        '\\.integration\\.spec\\.ts$',
    ],
    // uuid v13 ships as pure ESM; tell ts-jest to transform it so Jest can
    // require it in the CommonJS test environment.
    transformIgnorePatterns: [
        '/node_modules/(?!(uuid)/)',
    ],
    transform: {
        '^.+\\.(t|j)s$': [
            'ts-jest',
            {
                tsconfig: {
                    skipLibCheck: true,
                    forceConsistentCasingInFileNames: true,
                    types: ['jest', 'node'],
                },
            },
        ],
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: '../coverage',
    testEnvironment: 'node',
};