import { PRIVACY_POLICY } from '../../features/legal/content';
import { LegalDocument } from '../../features/legal/LegalDocument';

export default function PrivacyScreen() {
  return <LegalDocument doc={PRIVACY_POLICY} />;
}
