import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, MessageSquare } from 'lucide-react';

export default function ContactPage() {
  return (
    <>
      <div className="page-header page-header--support">
        <Link to="/" className="page-header__back-link" aria-label="Back to home">
          <ArrowLeft size={16} />
          <span>Back to Pixora</span>
        </Link>
        <h1 className="page-header__title">Contact Us</h1>
        <p className="page-header__sub">We are here to help. Reach out and we will get back to you shortly.</p>
      </div>

      <section className="contact-wrap">
        <div className="contact-card">
          <h2 className="contact-card__title">Get in touch</h2>
          <p className="contact-card__text">
            For support, partnership, or feedback about Pixora, contact us through any of the channels below.
          </p>

          <div className="contact-list">
            <div className="contact-item">
              <Mail size={18} />
              <div>
                <div className="contact-item__label">Email</div>
                <div className="contact-item__value">madhavanvairavan3@gmail.com</div>
              </div>
            </div>

            <div className="contact-item">
              <Phone size={18} />
              <div>
                <div className="contact-item__label">Phone</div>
                <div className="contact-item__value">9342258045</div>
              </div>
            </div>

            <div className="contact-item">
              <MapPin size={18} />
              <div>
                <div className="contact-item__label">Office</div>
                <div className="contact-item__value">Coimbatore</div>
              </div>
            </div>

            <div className="contact-item">
              <MessageSquare size={18} />
              <div>
                <div className="contact-item__label">Response time</div>
                <div className="contact-item__value">Within 24 hours</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
