import { InlineStringEditor } from './home';

export default {
  'Empty Input': () => {
    return (
      <div style={{ background: '#1a1a1a', padding: '20px' }}>
        <InlineStringEditor
          initialValue=""
          placeholder="Enter a name..."
          onSubmit={(value) => alert(`Submitted: ${value}`)}
          onCancel={() => alert('Cancelled')}
        />
      </div>
    );
  },

  'With Initial Value': () => {
    return (
      <div style={{ background: '#1a1a1a', padding: '20px' }}>
        <InlineStringEditor
          initialValue="Iron Smelting"
          placeholder="Factory name"
          onSubmit={(value) => alert(`Submitted: ${value}`)}
          onCancel={() => alert('Cancelled')}
        />
      </div>
    );
  },

  'With Validation - Valid': () => {
    return (
      <div style={{ background: '#1a1a1a', padding: '20px' }}>
        <InlineStringEditor
          initialValue="New Factory"
          placeholder="Factory name"
          checkValue={() => false} // Not taken
          onSubmit={(value) => alert(`Submitted: ${value}`)}
          onCancel={() => alert('Cancelled')}
        />
      </div>
    );
  },

  'With Validation - Name Taken': () => {
    const takenNames = ['Iron Smelting', 'Coal Processing', 'Power Plant'];
    
    return (
      <div style={{ background: '#1a1a1a', padding: '20px' }}>
        <p style={{ color: '#999', marginBottom: '10px', fontSize: '14px' }}>
          Taken names: {takenNames.join(', ')}
        </p>
        <InlineStringEditor
          initialValue="Iron Smelting"
          placeholder="Factory name"
          checkValue={(value) => takenNames.includes(value)}
          onSubmit={(value) => alert(`Submitted: ${value}`)}
          onCancel={() => alert('Cancelled')}
        />
      </div>
    );
  },

  'Multiple Editors': () => {
    const takenNames = ['Factory 1', 'Factory 2'];
    
    return (
      <div style={{ background: '#1a1a1a', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label style={{ color: '#999', marginBottom: '5px', display: 'block', fontSize: '12px' }}>
            Rename Zone:
          </label>
          <InlineStringEditor
            initialValue="Production Zone A"
            placeholder="Zone name"
            onSubmit={(value) => alert(`Zone renamed to: ${value}`)}
            onCancel={() => alert('Cancelled zone rename')}
          />
        </div>
        
        <div>
          <label style={{ color: '#999', marginBottom: '5px', display: 'block', fontSize: '12px' }}>
            New Factory (with validation):
          </label>
          <InlineStringEditor
            initialValue=""
            placeholder="Factory name"
            checkValue={(value) => takenNames.includes(value)}
            onSubmit={(value) => alert(`Created factory: ${value}`)}
            onCancel={() => alert('Cancelled factory creation')}
          />
        </div>
      </div>
    );
  },
};
