import React from 'react';

function NavBar ({ user, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">Video Web App</div>
      <div className="navbar-actions">
        {user ? (
          <>
            <span className="navbar-user">
              Signed in as <strong>{user.username}</strong>
            </span>
            <button type="button" className="btn" onClick={onLogout}>
              Log out
            </button>
          </>
        ) : (
          <span className="navbar-user">Welcome!</span>
        )}
      </div>
    </header>
  );
}

export default NavBar;
