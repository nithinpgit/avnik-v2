export function PreMeetingEventInfoTab() {
  return (
    <div className="host-info-content">
      <div className="host-details-bx">
        <div className="pre-meeting-event__row">
          <div className="pre-meeting-event__col">
            <div className="event-lft-sec">
              <div className="e-info-lft-img">
                <figure className="event-lft-img">
                  <img src="/vendor/pre-meeting/event-12.jpg" alt="" />
                </figure>
              </div>
              <div className="h-i-profile">
                <a href="#profile" onClick={(e) => e.preventDefault()}>
                  <figure className="cmn-profile-pic">
                    <img src="/vendor/pre-meeting/user-1.jpg" alt="" />
                  </figure>
                  <span>avnik kasliwal</span>
                  <p>
                    <i className="mr-star-rating-icon" aria-hidden />
                    <span>5</span>
                  </p>
                </a>
              </div>
            </div>
          </div>
          <div className="pre-meeting-event__col">
            <div className="event-right-content">
              <div className="meeting-short-info">
                <div className="meeting-time-date-bx">
                  <span>Wed, 14 May 2021 @ 12:30 PM</span>
                </div>
                <div className="meeting-space">
                  <h3>Meeting Specs</h3>
                  <div className="m-s-info">
                    <ul className="cmn-ul-list metting_section">
                      <li>
                        <span className="m-s-title">Seats</span>
                        <div className="m-s-content">
                          <i className="mr-seats-icon" aria-hidden />
                          <span> / Seats Left</span>
                        </div>
                      </li>
                      <li>
                        <span className="m-s-title">Duration</span>
                        <div className="m-s-content">
                          <i className="mr-user-chat-icon" aria-hidden />
                          <span>100+ Joined | 3:00 hrs</span>
                        </div>
                      </li>
                      <li>
                        <span className="m-s-title">Cost</span>
                        <div className="m-s-content cost-m-s">
                          <i className="mr-event-cost-icon" aria-hidden />
                          <span />
                        </div>
                      </li>
                      <li>
                        <span className="m-s-title">Type</span>
                        <div className="m-s-content">
                          <div className="event-type-icon">
                            <i className="mr-webinar1-icon e-icon-none e-icon-active" aria-hidden />
                          </div>
                          <span />
                        </div>
                      </li>
                    </ul>
                  </div>
                  <div className="meeting-timer-status">
                    <div className="m-t-s">
                      <span>Remianing Time - </span>
                      <strong className="timer-bx">24:00:00</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="description-bx">
          <div className="h-evnt-d">
            <strong>Description</strong>
            <div className="category-rit-bx">
              <span>Category : </span>
              <p>Medical / Surgery</p>
            </div>
            <p className="settings-dec" />
          </div>
        </div>
      </div>
    </div>
  )
}
