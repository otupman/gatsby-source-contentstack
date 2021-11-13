import { buildCustomSchema } from './normalize';

describe('buildCustomSchema', () => {
  const schema = {} // Schema from CS
  const parent = null;
  const prefix = 'prefix';
  const disableMandatoryFields = false;

  const build = schema => {
    return buildCustomSchema(schema, null, null, null, null, parent, prefix, disableMandatoryFields);
  }

  describe('fields', () => {
    const fieldFn = (type, opts) => ({
      uid: 'jestblt1010101',
      data_type: type,
      mandatory: true,
      multiple: true,
      ...opts,
    })
    const isoDate = opts => fieldFn('isodate', opts);
    const stringField = opts => fieldFn('text', opts);
    const numberField = opts => fieldFn('number', opts);

    const testCase = (fn, opts, expectedType) => {
      return {
        fieldFn: fn instanceof Function ? fn : opts => fieldFn(fn, opts),
        fieldOpts: opts,
        expectedType
      };
    };
    const objField = type => ({ type: type });

    it.each([
      testCase(stringField, { mandatory: true, multiple: true }, objField('[String]!') ),
      testCase(stringField, { mandatory: true, multiple: false }, objField('String!') ),
      testCase(stringField, { mandatory: false, multiple: true }, objField('[String]')),
      testCase(stringField, { mandatory: false, multiple: false}, objField('String')),
      testCase(isoDate, { mandatory: true, multiple: true }, '[Date]!' ),
      testCase(isoDate, { mandatory: true, multiple: false }, 'Date!' ),
      testCase(isoDate, { mandatory: false, multiple: true }, '[Date]'),
      testCase(isoDate, { mandatory: false, multiple: false}, 'Date'),
      testCase(numberField, { mandatory: true, multiple: true }, objField('[Int]!') ),
      testCase(numberField, { mandatory: true, multiple: false }, objField('Int!') ),
      testCase(numberField, { mandatory: false, multiple: true }, objField('[Int]')),
      testCase('number', { mandatory: false, multiple: false}, objField('Int')),
    ])
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

  describe('text fields', () => {
    it('has a resolver', () => {

    })
  })
})