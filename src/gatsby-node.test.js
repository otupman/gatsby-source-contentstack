
jest.doMock('gatsby-plugin-utils', () => ({
  isGatsbyNodeLifecycleSupported: () => false,
}))

jest.mock('./fetch', () => ({
  fetchData: () => {
    return new Promise((resolve) => {
      resolve({})
    })
  },
  fetchContentTypes: () => new Promise((resolve) => {
    resolve([])
  }),
}))

let createSchemaCustomization = null;
let normalize = null;

describe('createSchemaCustomization', () => {
  beforeEach( () => {
    jest.resetModules();

    jest.mock('./normalize', () => ({
      extendSchemaWithDefaultEntryFields: () => {},
      buildCustomSchema: jest.fn().mockImplementation(() => ({
        references: [], groups: [], fileFields: [], types: [],
      }))
    }))

    const { createSchemaCustomization: createSchemaCustomisationOrig  } = require('./gatsby-node')
    createSchemaCustomization = createSchemaCustomisationOrig;
    normalize = require('./normalize');
  })

  describe.each([
    [{ enableSchemaGeneration: true, }, 1],
    [{ enableSchemaGeneration: false, }, 0]
  ])(`with config %p is called %i times`, (pluginConfig, callCount) => {
    it('calls the customisation function if needed', async () => {
      const createTypesMock = jest.fn();

      await createSchemaCustomization(
        {
          cache: {set: () => {}},
          actions: { createTypes: createTypesMock, },
          schema: { buildObjectType: jest.fn() }
        },
        pluginConfig
      );

      expect(createTypesMock).toHaveBeenCalledTimes(callCount);
    })
  })
})