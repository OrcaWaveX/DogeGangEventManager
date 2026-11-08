import { Gamepad2, HeartHandshake, Users } from 'lucide-react'

const values = [
  { icon: Gamepad2, title: 'Play your way', text: 'Co-op, competitive, or casual. Any style is fine.' },
  { icon: HeartHandshake, title: 'Keep it friendly', text: 'Respect your teammates and make room for different skill levels.' },
  { icon: Users, title: 'Shared decisions', text: 'Availability and game votes decide what gets played and when.' },
]

export default function CommunityPage() {
  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <h1>Community</h1>
          <p>DogeGang+ is a Discord-based gaming group.</p>
        </div>
      </div>
      <div className="community-values">
        {values.map(({ icon: Icon, title, text }) => (
          <section className="rail-card" key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <p className="muted-note">Community polls and elections are planned for a later release.</p>
    </div>
  )
}
