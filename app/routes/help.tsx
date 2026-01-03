/**
 * Help route - renders the HelpHub modal as a route overlay
 */

import { useNavigate } from 'react-router';
import HelpHub from '~/help/HelpHub';

export default function HelpRoute() {
  const navigate = useNavigate();
  
  return (
    <HelpHub 
      isOpen={true} 
      onClose={() => navigate('..')} 
    />
  );
}
