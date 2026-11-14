import OperationalModule from './OperationalModule';

export const route = { path: '/patients', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'HeartPulse', label: 'PatientSuite', order: 13, profiles: ['Admin_c'] };

const config = {
  title: 'PatientSuite',
  audience: 'Unified patient identity and portal foundation',
  description: 'Maintain a unified patient register and consent records shared across pharmacy, laboratory and clinic workflows.',
  tags: ['Patient identity', 'Consent register', 'Shared record', 'Privacy'],
  entities: [
    {
      table: 'patients_c',
      label: 'Patient register',
      singular: 'Patient',
      fields: [
        { name: 'patient_code_c', label: 'Patient code', type: 'Text', required: true },
        { name: 'global_patient_id_c', label: 'Global patient ID', type: 'Text' },
        { name: 'full_name_c', label: 'Full name', type: 'Text', required: true },
        { name: 'phone_c', label: 'Phone', type: 'Text' },
        { name: 'email_c', label: 'Email', type: 'Text' },
        { name: 'date_of_birth_c', label: 'Date of birth', type: 'Date' },
        { name: 'gender_c', label: 'Gender', type: 'Text', options: ['Female', 'Male', 'Other', 'Prefer not to say'] },
        { name: 'blood_group_c', label: 'Blood group', type: 'Text' },
        { name: 'address_c', label: 'Address', type: 'MultilineText' },
        { name: 'allergy_notes_c', label: 'Allergy notes', type: 'MultilineText' },
        { name: 'status_c', label: 'Status', type: 'Text', options: ['Active', 'Inactive'] }
      ]
    },
    {
      table: 'patient_consents_c',
      label: 'Consent records',
      singular: 'Consent',
      fields: [
        { name: 'patient_c', label: 'Patient record ID', type: 'Text', required: true },
        { name: 'consent_type_c', label: 'Consent type', type: 'Text', options: ['Data Processing', 'WhatsApp Communication', 'Email Communication', 'Report Sharing', 'Care Coordination'] },
        { name: 'granted_c', label: 'Granted', type: 'Boolean', options: ['true', 'false'] },
        { name: 'captured_at_c', label: 'Captured at', type: 'DateTime' },
        { name: 'source_c', label: 'Source', type: 'Text' },
        { name: 'withdrawn_at_c', label: 'Withdrawn at', type: 'DateTime' },
        { name: 'notes_c', label: 'Notes', type: 'MultilineText' }
      ]
    }
  ],
  notes: [
    'Patient data is sensitive personal information. Do not upload real patient records until tenant isolation, consent enforcement, retention and access auditing are tested.',
    'Consent must be recorded per purpose and withdrawal must stop the relevant processing and communications.'
  ]
};

export default function Patients() {
  return <OperationalModule config={config} />;
}
