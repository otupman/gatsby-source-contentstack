const { buildCustomSchema } = require('./normalize')

describe('buildCustomSchema', () => {
  const schema = {} // Schema from CS
  const parent = 'Parent_value_from_test';
  const prefix = 'prefix';
  const disableMandatoryFields = false;
  const createSeparateGlobalFieldTypes = false;

  const build = (schema, opts = {customisationOptions: { disableMandatoryFields }}) => {
    const { customisationOptions } = opts;
    return buildCustomSchema(schema,
      null, null, null, null,
      parent,
      prefix,
      {
        disableMandatoryFields,
        createSeparateGlobalFieldTypes,
        ...customisationOptions,
      },
    );
  }
  const defaultUid = 'jest_root_type';
  const fieldFn = (type, opts = {}) => ({
    uid: defaultUid,
    data_type: type,
    mandatory: true,
    multiple: true,
    ...opts,
  })
  const isoDate = opts => fieldFn('isodate', opts);
  const stringField = opts => fieldFn('text', opts);
  const numberField = opts => fieldFn('number', opts);
  const blockField = opts => {
    const field = fieldFn('blocks', opts);
    field.blocks = [{schema: [isoDate({uid: `${field.uid}_isodate_field_1`})]}]
    return {
      ...field,
      ...opts,
    }
  }

  /**
   * Schema-like fields come with their full schema for every content type that
   * uses that schema-like field.  This is most relevant for global fields.
   *
   */
  const buildSchemaLikeField = (fieldType, opts) => {
    const field = fieldFn(fieldType, opts);
    // A group or global field w/out it's own field will be ignored
    field.schema = [stringField({uid: `${fieldType}_child_schema_field`})]
    return {
      ...field,
      ...opts,  // Override again blergh
    };
  }

  const buildGlobalField = (globalFieldName, opts) => {
    const field = buildSchemaLikeField('global_field', opts);
    field.reference_to = globalFieldName;
    return field;
  }

  const testCase = (fn, opts, expectedType) => {
    return {
      fieldFn: fn instanceof Function ? fn : opts => fieldFn(fn, opts),
      fieldOpts: opts,
      expectedType
    };
  };
  const objField = type => ({ type: type });

  const fieldTypesForMandatoryness = [
    ['text', 'String', 'resolves'],
    ['isodate', 'Date'],
    ['number', 'Int', 'resolves'],
    ['boolean', 'Boolean'],
    ['json', 'JSON', 'resolves'],
    ['link', 'linktype'],
    ['file', `${prefix}_assets`], // file is special
    [opts => buildSchemaLikeField('group', opts), `${parent}_${defaultUid}`],
    [opts => buildSchemaLikeField('global_field', opts), `${parent}_${defaultUid}`],
    [opts => blockField(opts), `${parent}_${defaultUid}`],
    // not blocks
    // not reference

  ]
  const processExpected = (type, returnType) => {
    return returnType === 'resolves' ? objField(type) : type;
  }
  const fieldDefsToMultiples = fieldTypeDefs =>  fieldTypeDefs.map(([type, expectedType, returnType]) => [
    testCase(type, { mandatory: true, multiple: true }, processExpected(`[${expectedType}]!`, returnType)),
    testCase(type, { mandatory: true, multiple: false }, processExpected(`${expectedType}!`, returnType)),
    testCase(type, { mandatory: false, multiple: true }, processExpected(`[${expectedType}]`, returnType)),
    testCase(type, { mandatory: false, multiple: false }, processExpected(`${expectedType}`, returnType)),
  ]).reduce((allTests, testsToAdd) => allTests.concat(testsToAdd))

  describe('Field Mandatoryness checks', () => {

    it.each(fieldDefsToMultiples(fieldTypesForMandatoryness))
    ( 'built $fieldOpts must be type $expectedType', ({ fieldFn, fieldOpts, expectedType }) => {
      const testField = fieldFn(fieldOpts);
      const builtFields = build([testField]);
      const builtField = builtFields.fields[testField.uid]
      if(builtField instanceof Object) {
        expect(builtField).toMatchObject(expectedType);
      }
      else {
        expect(builtField).toEqual(expectedType);
      }
    });

  });

  describe('resolver field types', () => {
    const fieldTypes = ['text', 'number', 'json'];
    it.each(fieldTypes)
    ('%s has a resolver that works', fieldType => {
      const testField = fieldFn(fieldType);
      const builtFields = build([testField]);
      const builtField = builtFields.fields[testField.uid]
      const sourceWithField = {[testField.uid]: 'Found'}

      expect(builtField.resolve).not.toBeNull();
      expect(builtField.resolve(sourceWithField)).toEqual('Found');
      expect(builtField.resolve({})).toBeNull();
    })
  })

  describe('Complex field types', () => {
    describe('files', () => {
      it('adds to the type list', () => {
        expect(build([fieldFn('file')]).types).toContain(`type ${prefix}_assets implements Node @infer { url: String }`)
      });
      it('adds to the file field list', () => {
        const field = fieldFn('file');
        const builtFileField = build([field]).fileFields[0];
        expect(builtFileField.parent).toEqual(parent);
        expect(builtFileField.field).toEqual(field);
      });

      describe('Block fields', () => {
        it('declares a type', () => {
          expect(build([blockField()]).types[0])
            .toContain(`type ${parent}_${defaultUid}`)
        })
        it('infers sub-fields', () => {
          expect(build([blockField()]).types[0])
            .toContain(`${defaultUid}_isodate_field_1:[Date]!`)
        });

        describe('with no sub-schema', () => {
          it('declares the type', () => {
            expect(build([blockField()]).types[0])
              .toContain(`type ${parent}_${defaultUid}`)
          })
          it('does _not_ infer anything', () => {
            // Note: this is different to group-like fields for not apparent
            // reason.
            expect(build([blockField()]).types)
              .not.toContain('@infer')
          })
        })
      })

      describe('Reference fields', () => {
        describe('with 1 reference', () => {
          describe.each([
            ['string', 'solo_target_type', ],
            ['array', ['solo_target_type'], ]
          ])('and is of type %s (%p)', (_, referenceTo) => {
            const builtSchema = build([fieldFn(
              'reference', { reference_to: referenceTo, }
            )]);

            it('declares the type', () => {
              expect(builtSchema.types[0])
                .toContain(`type ${prefix}_solo_target_type`)
            })

            it('adds to the list of references', () => {
              expect(builtSchema.references[0]).toMatchObject({
                parent,
                uid: defaultUid,
              })
            })

            describe('field type', () => {
              // Can't use the blanket mandatoryness test as it
              // assumes non-multiples are possible - and they're not on references
              it('is set correctly', () => {
                expect(builtSchema.fields[defaultUid])
                  .toEqual(`[${prefix}_solo_target_type]!`)
              })
            })
          })

        })

        describe('with >1 references', () => {
          const targets = ['target_1', 'target_2'];
          const builtSchema = build([fieldFn(
            'reference', { reference_to: targets, }
          )]);

          describe('the union type', () => {
            it('declares a union type name using the target names', () => {
              // Union type is added last
              expect(builtSchema.types[targets.length])
                .toContain(`union ${prefix}_target_1prefix_target_2_Union`);
            })

            it('references all the target types', () => {
              expect(builtSchema.types[targets.length])
                .toContain(` = ${prefix}_target_1 | ${prefix}_target_2`)
            })

            it.each(targets)('declares the target types %s', (targetName) => {
              // TODO: Fix the assumed ordering of the target types
              expect(builtSchema.types[targets.indexOf(targetName)])
                .toEqual(`type ${prefix}_${targetName} implements Node @infer { title: String! }`)
            })
          })

          it('adds to the list of references', () => {
            expect(builtSchema.references[0]).toMatchObject({
              parent,
              uid: defaultUid,
            })
          })

          describe('field type', () => {
            // Can't use the blanket mandatoryness test as it
            // assumes non-multiples are possible - and they're not on references
            it('is set correctly', () => {
              expect(builtSchema.fields[defaultUid])
                .toEqual(`[${prefix}_target_1prefix_target_2_Union]!`)
            })
          })

        })
      })

      fdescribe('Global fields', () => {
        describe('when a global field has already been defined', () => {
          it('does not create a new one', () => {});
          it('updates the groups', () => {});

        })

        describe.each([
          [{ createSeparateGlobalFieldTypes: true}, 'my_global_field_type_name'],
          [{ createSeparateGlobalFieldTypes: false}, 'Parent_value_from_test_jest_root_type'],
        ])
        (`when %p created type name is %s`, (schemaConfig, expectedTypeName) => {
          const schemaLikeField = buildGlobalField(
            'my_global_field_type_name',
            { schema: [ stringField( {uid: 'subfield_1'} ) ] }
          );
          const builtSchema = build(
            [schemaLikeField],
            {customisationOptions: schemaConfig}
          );

          describe('the declared sub-type', () => {
            it('is declared', () => {
              expect(builtSchema.types[0])
                .toContain(`type ${expectedTypeName}`)
            });
            it('infers sub-fields', () => {
              expect(builtSchema.types[0])
                .toContain('subfield_1:[String]!')
            })
          })

          describe('type names of the sub-fields', () => {
            describe('complex types', () => {
              // The initial list of fields that is generated should only be simple
              // type _names_ because their full types are on the type that is
              // also _built_ when the global/group field is built
              it('are names only', () => {
                expect(builtSchema.fields[schemaLikeField.uid])
                  .toEqual(`[${expectedTypeName}]!`)
              })
            })
            describe('simple types', () => {
              it('are inline with names only', () => {
                const schemaWithSimpleSubField =
                  buildSchemaLikeField('global_field', {schema: [isoDate()]});

                // Simple types are brought in, in-line, i.e. so the content
                // type using a global field with a date field will both
                // define the global field type with the date field, but the
                // date field will _also_ be defined on the content type
                // _using_ that global field.
                expect(build([schemaWithSimpleSubField]).fields[schemaLikeField.uid])
                  .toEqual(`[Parent_value_from_test_jest_root_type]!`)
              })
            })
          })


          describe('when there are no sub-schema fields', () => {
            const emptySchemaLikeField = buildSchemaLikeField('global_field', {schema: []})
            it('does not get added to the field list', () => {
              expect(Object.keys(build([emptySchemaLikeField]).fields)).not.toContain(emptySchemaLikeField.uid);
            })
            it('is not added to the type list', () => {
              expect(build([emptySchemaLikeField]).types).toEqual([])
            })
          })
        })


      })

      describe('Group fields', () => {
        const schemaLikeField = buildSchemaLikeField(
          'group',
          { schema: [ stringField( {uid: 'subfield_1'} ) ] }
        );

        describe('the declared sub-type', () => {
          it('is declared', () => {
            expect(build([schemaLikeField]).types[0]).toContain(`type ${parent}_${schemaLikeField.uid}`)
          });
          it('infers sub-fields', () => {
            expect(build([schemaLikeField]).types[0]).toContain('subfield_1:[String]!')
          })
        })

        describe('type names of the sub-fields', () => {
          describe('complex types', () => {
            // The initial list of fields that is generated should only be simple
            // type _names_ because their full types are on the type that is
            // also _built_ when the global/group field is built
            it('are names only', () => {
              expect(build([schemaLikeField]).fields[schemaLikeField.uid])
                .toEqual(`[${parent}_${schemaLikeField.uid}]!`)
            })
          })
          describe('simple types', () => {
            it('are names only', () => {
              const schemaWithSimpleSubField = buildSchemaLikeField('group', {schema: [isoDate()]});

              expect(build([schemaWithSimpleSubField]).fields[schemaLikeField.uid])
                .toEqual(`[${parent}_${schemaLikeField.uid}]!`)
            })
          })
        })


        describe('when there are no sub-schema fields', () => {
          const emptySchemaLikeField = buildSchemaLikeField('global_field', {schema: []})
          it('does not get added to the field list', () => {
            expect(Object.keys(build([emptySchemaLikeField]).fields)).not.toContain(emptySchemaLikeField.uid);
          })
          it('is not added to the type list', () => {
            expect(build([emptySchemaLikeField]).types).toEqual([])
          })
        })

      })

    })
  })
})