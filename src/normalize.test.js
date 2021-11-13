import { buildCustomSchema } from './normalize';

describe('buildCustomSchema', () => {
  const schema = {} // Schema from CS
  const parent = null;
  const prefix = 'prefix';
  const disableMandatoryFields = false;

  const build = schema => {
    return buildCustomSchema(schema, null, null, null, null, parent, prefix, disableMandatoryFields);
  }

  describe('text field', () => {
    const stringField = opts => {
      return {
        uid: 'jestblt1010101',
        data_type: 'text',
        mandatory: true,
        multiple: true,
        ...opts,
      }
    }
    const testCase = (fn, opts, expectedType) => ({fieldFn: fn, fieldOpts: opts, expectedType});

    it.each([
      { fieldFn: stringField, fieldOpts: { mandatory: true, multiple: true }, expectedType: '[String]!' },
      { fieldFn: stringField, fieldOpts: { mandatory: true, multiple: false }, expectedType: 'String!' },
      testCase(stringField, { mandatory: false, multiple: true }, '[String]'),
      testCase(stringField, { mandatory: false, multiple: false}, 'String')
    ])
    ( 'built $fieldOpts must be type $expectedType', ({ fieldFn, fieldOpts, expectedType }) => {
      const testField = fieldFn(fieldOpts);
      const builtFields = build([testField]);
      const builtField = builtFields.fields[testField.uid]
      expect(builtField).toMatchObject({ type: expectedType });
    });


  })
})