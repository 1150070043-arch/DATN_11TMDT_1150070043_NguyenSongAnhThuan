import { dateTime, statusLabel } from "../lib/format";
import type { Order } from "../types";

export function OrderTimeline({ order }: { order: Order }) {
  const history = order.statusHistory ?? [];
  if (history.length === 0) return null;

  return (
    <section className="order-timeline" aria-labelledby="order-progress-title">
      <div className="section-kicker" id="order-progress-title">Hành trình đơn hàng</div>
      <ol>
        {history.map((event, index) => (
          <li className={index === history.length - 1 ? "is-current" : ""} key={event.id}>
            <span className="timeline-marker" aria-hidden="true" />
            <div className="timeline-copy">
              <strong>{statusLabel[event.toStatus]}</strong>
              <time dateTime={event.createdAt}>{dateTime.format(new Date(event.createdAt))}</time>
              {(event.note || event.changedByName) && (
                <small>
                  {[event.note, event.changedByName].filter(Boolean).join(" · ")}
                </small>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
