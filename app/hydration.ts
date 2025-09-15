
const hydration = {
  reviver: (_: string, value: unknown) => {
    // Check it's an object at all
    if (value && typeof value === 'object') {
      // These are mostly for TS checks
      if (!Object.hasOwn(value, '_dataType')) return value;
      if (!("data" in value && "_dataType" in value)) return value;

      if (value._dataType === 'Map') {
        return new Map(value.data as [unknown, unknown][]);
      } else if (value._dataType === 'Set') {
        return new Set(value.data as [unknown, unknown][]);
      }
      console.error('Unknown data type in localStorage', value._dataType);
    }

    return value;
  },
  replacer: (_: string, value: unknown) => {
    if (value instanceof Map) {
      return {
        _dataType: 'Map',
        data: Array.from(value.entries()),
      };
    } else if (value instanceof Set) {
      return {
        _dataType: 'Set',
        data: Array.from(value.values()),
      };
    }
    return value;
  }
}
export default hydration;
