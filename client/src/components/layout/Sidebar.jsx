import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  MdDashboard, MdPeople, MdPhoneCallback, MdSchedule,
  MdGroups, MdOndemandVideo, MdLogout, MdDynamicForm, MdMessage
} from 'react-icons/md';

const navItems = [
  { to: '/app', icon: MdDashboard, label: 'Dashboard', exact: true },
  { to: '/app/leads', icon: MdPeople, label: 'Leads' },
  { to: '/app/followups', icon: MdSchedule, label: 'Followups' },
  { to: '/app/calling', icon: MdPhoneCallback, label: 'Calling List' },
  { to: '/app/team', icon: MdGroups, label: 'Team' },
  { to: '/app/webinars', icon: MdOndemandVideo, label: 'Webinars' },
  { to: '/app/messages', icon: MdMessage, label: 'Messages' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleMouseEnter = () => setIsOpen(true);
  const handleMouseLeave = () => setIsOpen(false);

  return (
    <aside
      className={`sidebar ${isOpen ? 'open' : 'closed'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="sidebar-header">
        <div className="brand">
          <MdDynamicForm className="brand-icon" />
          {isOpen && <span className="brand-name">Dashneem</span>}
        </div>
      </div>

      {isOpen && user && (
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.avatar ? <img src={user.avatar} alt={user.name} /> : <span>{user.name?.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems
          .filter((item) => !item.adminOnly || user?.role === 'admin')
          .map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon className="nav-icon" />
            {isOpen && <span className="nav-label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button className="logout-btn" onClick={logout}>
        <MdLogout className="nav-icon" />
        {isOpen && <span>Logout</span>}
      </button>
    </aside>
  );
}
