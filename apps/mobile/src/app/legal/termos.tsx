import { TERMS_OF_USE } from '../../features/legal/content';
import { LegalDocument } from '../../features/legal/LegalDocument';

export default function TermsScreen() {
  return <LegalDocument doc={TERMS_OF_USE} />;
}
