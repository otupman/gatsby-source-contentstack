
let createSchemaCustomization = null;

describe('createSchemaCustomization', () => {
  beforeEach(() => {
    jest.resetModules();
    // TODO: figure out how to mock the package.json
    // jest.mock('./package.json', () => ([1, 2, 3]));

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
    jest.mock('./normalize', () => ({
      extendSchemaWithDefaultEntryFields: () => {},
      buildCustomSchema: () => ({
        references: [], groups: [], fileFields: [], types: [],
      }),
    }))

    const { createSchemaCustomization: createSchemaCustomizationOrig,  } = require('./gatsby-node')

    createSchemaCustomization = createSchemaCustomizationOrig;
  });

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