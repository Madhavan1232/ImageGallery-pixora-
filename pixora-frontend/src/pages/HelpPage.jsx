import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquareWarning } from 'lucide-react';
import { supportAPI } from '../services/api';

export default function HelpPage() {
  const [form, setForm] = useState({
    type: 'Report',
    email: '',
    subject: '',
    description: '',
    reportedPerson: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = 'Enter a valid email';
    if (!form.subject.trim()) next.subject = 'Subject is required';
    if (!form.description.trim()) next.description = 'Description is required';
    else if (form.description.trim().length < 10) next.description = 'Please add more details (min 10 chars)';
    return next;
  };

  const onChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSubmitting(true);
      await supportAPI.submitHelp(form);
      toast.success('Your request has been submitted. We will contact you soon.');
      setForm({ type: 'Report', email: '', subject: '', description: '', reportedPerson: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header page-header--support">
        <Link to="/" className="page-header__back-link" aria-label="Back to home">
          <ArrowLeft size={16} />
          <span>Back to Pixora</span>
        </Link>
        <h1 className="page-header__title">Help Us</h1>
        <p className="page-header__sub">Send your report or query and our team will review it.</p>
      </div>

      <section className="help-wrap">
        <div className="help-card">
          <div className="help-card__head">
            <MessageSquareWarning size={18} />
            <h2>Submit a report or query</h2>
          </div>

          <form className="help-form" onSubmit={handleSubmit} noValidate>
            <div className="help-field">
              <label htmlFor="help-type">Request type</label>
              <select id="help-type" value={form.type} onChange={onChange('type')}>
                <option value="Report">Report</option>
                <option value="Query">Query</option>
              </select>
            </div>

            <div className="help-field">
              <label htmlFor="help-email">Your email address</label>
              <input
                id="help-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={onChange('email')}
              />
              {errors.email && <span className="help-error">{errors.email}</span>}
            </div>

            <div className="help-field">
              <label htmlFor="help-subject">Subject</label>
              <input
                id="help-subject"
                type="text"
                placeholder="Brief subject"
                value={form.subject}
                onChange={onChange('subject')}
              />
              {errors.subject && <span className="help-error">{errors.subject}</span>}
            </div>

            <div className="help-field">
              <label htmlFor="help-reported-person">Reported person (optional)</label>
              <input
                id="help-reported-person"
                type="text"
                placeholder="Username, email, or profile link"
                value={form.reportedPerson}
                onChange={onChange('reportedPerson')}
              />
            </div>

            <div className="help-field">
              <label htmlFor="help-description">Description</label>
              <textarea
                id="help-description"
                placeholder="Explain your issue or question in detail"
                rows={6}
                value={form.description}
                onChange={onChange('description')}
              />
              {errors.description && <span className="help-error">{errors.description}</span>}
            </div>

            <button type="submit" className="help-submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
