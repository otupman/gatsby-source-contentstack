import { buildCustomSchema } from './normalize';

describe('buildCustomSchema', () => {
  const schema = {} // Schema from CS
  const parent = null;
  const prefix = 'prefix';
  const disableMandatoryFields = false;

  const build = schema => {
    return buildCustomSchema(schema, null, null, null, null, parent, prefix, disableMandatoryFields);
  }

  const fieldFn = (type, opts = {}) => ({
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

  const simpleFieldTypes = [
    ['text', 'String', 'resolves'],
    ['isodate', 'Date'],
    ['number', 'Int', 'resolves'],
    ['boolean', 'Boolean'],
    ['json', 'JSON', 'resolves'],
    ['link', 'linktype'],
    ['file', `${prefix}_assets`], // file is special
    // not group
    // not global field
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

  describe('simple fields', () => {

    it.each(fieldDefsToMultiples(simpleFieldTypes))
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
})