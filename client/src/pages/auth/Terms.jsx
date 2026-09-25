import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from './Login';

const SECTIONS = [
  {
    title: '1. Accepting these terms',
    body: 'By creating a VibeChat account or using the app you agree to these terms. If you do not agree, do not use the service.',
  },
  {
    title: '2. Your account',
    body: 'You are responsible for keeping your password safe and for activity on your account. Usernames must be 3 to 30 characters using letters, numbers, or underscores, and must not impersonate another person or brand.',
  },
  {
    title: '3. Acceptable use',
    body: 'Do not use VibeChat to harass, threaten, or spam others. Do not upload illegal content, malware, or content you do not have the rights to share. Do not attempt to access other users private conversations or accounts.',
  },
  {
    title: '4. Your content',
    body: 'You keep ownership of the photos, videos, and messages you send. By sending content you allow us to store and deliver it to the person you sent it to. Deleted content is removed from your view; copies may persist in encrypted backups for a limited period.',
  },
  {
    title: '5. Privacy',
    body: 'We collect the minimum data needed to run the service: your account details, your conversations, and basic technical logs. We do not sell your data. Conversations are private between you and the person you message.',
  },
  {
    title: '6. Availability',
    body: 'We aim for reliable service but do not guarantee uninterrupted access. Features may change, and accounts that violate these terms may be suspended.',
  },
  {
    title: '7. Disclaimers and liability',
    body: 'The service is provided as is without warranties of any kind. To the maximum extent permitted by law we are not liable for indirect or consequential damages arising from your use of the app.',
  },
  {
    title: '8. Changes to these terms',
    body: 'We may update these terms. When we do, we will change the date below. Continued use after an update means you accept the revised terms.',
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-50">VibeChat</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <ArrowLeft size={16} />
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Terms of Service</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Last updated: September 23, 2026</p>

        <div className="mt-8 space-y-7">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{section.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-neutral-500 dark:text-neutral-400">
          Questions? Contact the account owner or reach out from the app settings page.
        </p>
      </main>
    </div>
  );
}
