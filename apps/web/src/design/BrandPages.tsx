import { useContext, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, setCsrfToken } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DataCtx } from './Reference';
import { Arrow, ReadingJourney } from './StorefrontExperience';

export function AboutPage() {
  const { books, categories } = useContext(DataCtx);
  return <div className="brand-page">
    <section className="story-hero experience-container">
      <div className="story-intro"><span className="story-kicker">Một chút về Thất Tịnh</span><h1>Một cuốn sách.<br />Nhiều điều <em>mở ra.</em></h1><p>Có những chuyến đi bắt đầu bằng một bước chân. Cũng có những chuyến đi bắt đầu khi ta mở một trang sách.</p><p className="story-secondary">Thất Tịnh là nơi bạn tìm một cuốn sách cho sự tò mò, cho công việc, hay chỉ cho một buổi chiều thật riêng.</p><div className="story-actions"><Link className="story-button" to="/catalog">Tìm cuốn sách của bạn<Arrow /></Link><Link className="story-link" to="/contact">Trò chuyện với Thất Tịnh<Arrow /></Link></div></div>
      <div className="story-collage" aria-label="Góc đọc sách Thất Tịnh"><div className="story-photo"><img src="/design/hero/library-1440.webp" alt="Những kệ sách trong thư viện" fetchPriority="high" /><span className="photo-caption">Mỗi trang sách, một góc nhìn mới.</span></div><div className="story-photo-small"><img src="/design/hero/reading-640.webp" alt="Một cuốn sách mở bên tách cà phê" /></div><div className="story-note"><span aria-hidden="true">“</span><p>Đọc chậm một chút.<br />Thấy nhiều hơn một chút.</p><small>THẤT TỊNH BOOKSTORE</small></div></div>
    </section>
    <section className="story-manifesto" data-reveal><div className="experience-container manifesto-layout"><span className="story-kicker">Điều chúng tôi tin</span><div><h2>Sách không chỉ để xếp lên kệ.<br /><em>Sách để ở lại trong bạn.</em></h2><p>Một ý tưởng mới. Một góc nhìn khác. Một câu chuyện khiến ta muốn lật thêm trang nữa. Chúng tôi muốn việc tìm thấy những cuốn sách ấy trở nên gần gũi và dễ dàng hơn.</p></div></div></section>
    <section className="experience-container story-values" data-reveal><div className="section-heading"><div><span className="story-kicker">Ở đây có gì?</span><h2>Ít ồn ào hơn.<br /><em>Nhiều điều để khám phá.</em></h2></div><p>{books.length ? `${books.length} đầu sách` : 'Những tựa sách'}{categories.length ? `, ${categories.length} thể loại` : ''} — từ kiến thức thực tiễn đến những câu chuyện đưa trí tưởng tượng đi xa.</p></div><div className="value-grid">{[
      ['01', 'Một kệ sách nhiều góc nhìn', 'Văn học, công nghệ, kỹ năng và hơn thế nữa. Bạn có thể bắt đầu từ điều mình yêu, rồi thử bước sang một điều mới.'],
      ['02', 'Chọn với đủ thông tin', 'Tác giả, giới thiệu, ISBN và nhận xét của độc giả được đặt cạnh cuốn sách, giúp bạn hiểu trước khi quyết định.'],
      ['03', 'Mua sách, thật nhẹ nhàng', 'Một giỏ sách dễ quản lý, thông tin đặt hàng rõ ràng và lịch sử đơn hàng để bạn theo dõi bất cứ lúc nào.'],
    ].map(([number, title, description]) => <article className="value-card" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
    <ReadingJourney />
    <section className="experience-container story-closing" data-reveal><span className="story-kicker">Hẹn bạn ở trang tiếp theo</span><h2>Hôm nay, bạn muốn<br /><em>đọc điều gì?</em></h2><Link to="/catalog" className="story-button">Dạo một vòng nhà sách<Arrow /></Link></section>
  </div>;
}

const topics = [
  { id: 'books', title: 'Tư vấn sách', description: 'Tìm một tựa sách, hỏi thêm về nội dung.', icon: '01' },
  { id: 'orders', title: 'Đơn hàng', description: 'Thông tin đặt sách và trạng thái đơn.', icon: '02' },
  { id: 'account', title: 'Tài khoản', description: 'Đăng nhập, xác minh và bảo mật.', icon: '03' },
  { id: 'feedback', title: 'Góp ý khác', description: 'Một ý tưởng để Thất Tịnh tốt hơn.', icon: '04' },
];
const faqs = [
  ['Làm sao để mua một cuốn sách?', 'Mở trang sách và chọn Mua ngay để tới thanh toán, hoặc Thêm vào giỏ nếu muốn chọn thêm. Bạn cần đăng nhập, điền thông tin nhận hàng và xác nhận đơn.'],
  ['Tôi xem trạng thái đơn hàng ở đâu?', 'Đăng nhập tài khoản đã đặt sách, mở mục Đơn hàng và chọn đơn cần xem. Lịch sử xử lý và trạng thái thanh toán được hiển thị trong chi tiết đơn.'],
  ['Tôi có thể hủy đơn đã đặt không?', 'Mở chi tiết đơn trong Đơn hàng. Nếu trạng thái đơn còn cho phép hủy, bạn sẽ thấy thao tác Hủy đơn. Với giao dịch đã thanh toán, hãy gửi mã đơn để nhà sách hỗ trợ kiểm tra.'],
  ['Tôi quên mật khẩu thì làm thế nào?', 'Chọn Quên mật khẩu ở màn hình đăng nhập, nhập email đã đăng ký và làm theo liên kết trong thư. Nếu chưa nhận được thư, kiểm tra cả mục thư rác.'],
];

export function ContactPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [topic, setTopic] = useState(topics.some(item => item.id === params.get('topic')) ? params.get('topic')! : 'books');
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState('');
  const pending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const subject = topics.find(item => item.id === topic)!;
  function next(value: number) { setError(''); setStep(value); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (step < 2) { next(step + 1); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const csrf = await api<{ csrfToken: string | null }>('/api/contact/csrf');
      setCsrfToken(csrf.data.csrfToken);
      const result = await api<{ reference: string }>('/api/contact', { method: 'POST', body: JSON.stringify({ name: name.trim(), email: email.trim(), topic, message: message.trim() }) });
      if (!result.data.reference) throw new Error('Chưa xác nhận được yêu cầu. Nội dung của bạn vẫn được giữ lại.');
      setTicket(result.data.reference); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa gửi được yêu cầu. Bạn có thể thử lại.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="brand-page contact-page">
    <section className="contact-intro experience-container"><span className="story-kicker">Kết nối với Thất Tịnh</span><h1>Một câu hỏi nhỏ.<br /><em>Một cuộc trò chuyện mới.</em></h1><p>Về một cuốn sách, một đơn hàng, hay một ý tưởng.<br className="hidden sm:block" /> Chúng tôi ở đây để lắng nghe.</p></section>
    <section className="contact-layout experience-container">
      <aside className="contact-aside"><div className="contact-note"><span className="contact-note-icon" aria-hidden="true">✳</span><span className="story-kicker">Bắt đầu từ điều bạn cần</span><h2>Gửi một lời nhắn,<br /><em>phần còn lại để Thất Tịnh.</em></h2><p>Chọn chủ đề và kể thêm một chút. Với câu hỏi về đơn hàng, nhớ kèm mã đơn để chúng tôi dễ kiểm tra.</p></div><div className="contact-shortcuts"><Link to="/orders"><span>Xem đơn đã đặt<small>Theo dõi trạng thái đơn của bạn</small></span><Arrow /></Link><Link to="/catalog"><span>Tìm một cuốn sách<small>Dạo qua những lựa chọn đang có</small></span><Arrow /></Link></div><p className="contact-privacy">Chỉ gửi thông tin cần thiết cho việc hỗ trợ. Đừng gửi mật khẩu hoặc thông tin thẻ thanh toán.</p></aside>
      <div className="contact-form-card">
        {ticket ? <div className="contact-success flow-enter" role="status"><span className="success-mark" aria-hidden="true">✓</span><span className="story-kicker">Cảm ơn bạn đã viết</span><h2 ref={heading} tabIndex={-1}>Lời nhắn đã được gửi.</h2><p>Thất Tịnh sẽ phản hồi qua <strong>{email}</strong> sau khi xem yêu cầu của bạn.</p><div className="contact-reference"><span>Mã tham chiếu</span><code>{ticket}</code></div><button className="story-button" onClick={() => { setTicket(''); setMessage(''); next(0); }}>Gửi một lời nhắn khác<Arrow /></button></div> : <form onSubmit={event => void submit(event)} aria-busy={busy}>
          <ol className="contact-steps" aria-label="Các bước liên hệ">{['Chủ đề', 'Lời nhắn', 'Kiểm tra'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={index <= step ? 'is-reached' : ''}><span>{index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
          <div key={step} className="flow-enter"><span className="story-kicker">Bước 0{step + 1} / 03</span><h2 ref={heading} tabIndex={-1}>{step === 0 ? 'Bạn cần giúp điều gì?' : step === 1 ? 'Kể cho chúng tôi nghe.' : 'Mọi thứ đã đúng chưa?'}</h2>
            {step === 0 && <fieldset className="contact-topics"><legend className="sr-only">Chọn chủ đề hỗ trợ</legend>{topics.map(item => <label className={`contact-topic ${topic === item.id ? 'is-selected' : ''}`} key={item.id}><input type="radio" name="topic" value={item.id} checked={topic === item.id} onChange={() => setTopic(item.id)} /><span className="topic-number">{item.icon}</span><span><b>{item.title}</b><small>{item.description}</small></span><span className="topic-check" aria-hidden="true">{topic === item.id ? '✓' : '+'}</span></label>)}</fieldset>}
            {step === 1 && <div className="contact-fields"><div className="contact-field-row"><label>Họ và tên<input name="name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Bạn tên là gì?" /></label><label>Email nhận phản hồi<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="ban@email.com" /></label></div><label>Lời nhắn của bạn<textarea name="message" required minLength={10} maxLength={3000} rows={6} value={message} onChange={event => setMessage(event.target.value)} placeholder="Bạn đang tìm cuốn sách nào, hoặc cần hỗ trợ điều gì?" /><span className="field-hint">Ít nhất 10 ký tự<span>{message.length}/3000</span></span></label></div>}
            {step === 2 && <div className="contact-review"><dl><div><dt>Chủ đề</dt><dd>{subject.title}</dd></div><div><dt>Người gửi</dt><dd>{name}</dd></div><div><dt>Email</dt><dd>{email}</dd></div></dl><div className="contact-message-preview">{message}</div><p>Yêu cầu sẽ được gửi tới hộp thư hỗ trợ của nhà sách.</p></div>}
          </div>
          {error && <div className="contact-error" role="alert">{error}</div>}
          <div className="contact-form-actions">{step > 0 ? <button type="button" className="story-link" disabled={busy} onClick={() => next(step - 1)}><Arrow back />Quay lại</button> : <span className="contact-step-hint">Một vài bước, không cần đăng nhập.</span>}<button type="submit" disabled={busy} className="story-button">{busy ? 'Đang gửi…' : step < 2 ? 'Tiếp tục' : 'Gửi lời nhắn'}{busy ? <span className="sending-spinner" aria-hidden="true" /> : <Arrow />}</button></div>
        </form>}
      </div>
    </section>
    <section className="contact-faq experience-container" data-reveal><div><span className="story-kicker">Có thể bạn đang thắc mắc</span><h2>Câu trả lời,<br /><em>ngay ở đây.</em></h2><p>Một vài điều giúp bạn tiếp tục hành trình đọc mà không phải chờ.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span className="faq-number">0{index + 1}</span><span>{question}</span><span className="faq-plus" aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
  </div>;
}
