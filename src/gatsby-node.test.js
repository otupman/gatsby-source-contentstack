
let createSchemaCustomization = null;

describe('createSchemaCustomization', () => {
  beforeEach(() => {
    jest.resetModules();
    // TODO: figure out how to mock the package.json
    // jest.mock('./package.json', () => ([1, 2, 3]));

    jest.doMock('gatsby-plugin-utils', () => ({
      isGatsbyNodeLifecycleSupported: () => false,
    }))

    const { createSchemaCustomizationOrig } = require('./gatsby-node')

    createSchemaCustomization = createSchemaCustomizationOrig;
  });

  it('does something', () => {

  })
})