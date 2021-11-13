import { buildCustomSchema } from './normalize';

describe('buildCustomSchema', () => {
  const schema = {} // Schema from CS
  const parent = 'Parent_value_from_test';
  const prefix = 'prefix';
  const disableMandatoryFields = false;

  const build = schema => {
    return buildCustomSchema(schema, null, null, null, null, parent, prefix, disableMandatoryFields);
  }
  const defaultUid = 'jestblt1010101';
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
    field.blocks = []
    return field;
  }

  const buildSchemaLikeField = (fieldType, opts) => {
    const field = fieldFn(fieldType, opts);
    // A group or global field w/out it's own field will be ignored
    field.schema = [stringField({uid: `${fieldType}_child_schema_field`})]
    return {
      ...field,
      ...opts,  // Override again blergh
    };
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

      })

      describe('Group-like fields', () => {
        const schemaLikeField = buildSchemaLikeField(
          'global_field',
          { schema: [ stringField( {uid: 'subfield_1'} ) ] }
        );

        describe('the declared sub-type', () => {
          it('is declared', () => {
            expect(build([schemaLikeField]).types[0]).toContain(`type ${parent}_${defaultUid}`)
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