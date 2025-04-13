// Virtual Debate Partner - Main Script

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const chatMessages = document.getElementById('chat-messages');
    const emptyState = document.getElementById('empty-state');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const debateList = document.getElementById('debate-list');
    const currentTopic = document.getElementById('current-topic');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const newDebateForm = document.getElementById('new-debate-form');

    // State
    let currentDebateId = null;
    let userId = localStorage.getItem('userId');
    let username = localStorage.getItem('username');

    // Initialize
    if (userId) {
        loadDebates(userId);
    }

    // Event Listeners
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    newDebateForm.addEventListener('submit', handleNewDebate);

    // Functions
    async function handleSendMessage() {
        const message = userInput.value.trim();
        if (message && currentDebateId) {
            // Disable input while processing
            userInput.disabled = true;
            sendButton.disabled = true;

            try {
                // Add user message to UI immediately
                addMessage(message, 'user');

                // Clear input
                userInput.value = '';

                // Send message to API
                const response = await fetch(`/api/debates/${currentDebateId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: message })
                });

                if (!response.ok) {
                    throw new Error('Failed to send message');
                }

                const data = await response.json();

                // Add AI response to UI
                const aiMessage = data.messages[1].content;
                addMessage(aiMessage, 'assistant');
            } catch (error) {
                console.error('Error sending message:', error);
                showNotification('Error sending message. Please try again.', 'error');
            } finally {
                // Re-enable input
                userInput.disabled = false;
                sendButton.disabled = false;
                userInput.focus();
            }
        }
    }

    function addMessage(content, role) {
        // Hide empty state if visible
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');

        if (role === 'user') {
            messageDiv.classList.add('user-message');
            messageDiv.innerHTML = `<p>${content}</p>`;
        } else {
            messageDiv.classList.add('assistant-message');
            messageDiv.innerHTML = `<p>${content}</p>`;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function loadDebates(userId) {
        try {
            // Check if debateList exists
            if (!debateList) {
                console.warn('Debate list element not found in DOM');
                return; // Exit early if the element doesn't exist
            }

            const response = await fetch(`/api/debates?userId=${userId}`);
            if (!response.ok) {
                throw new Error('Failed to load debates');
            }

            const debates = await response.json();

            // Clear existing debates
            debateList.innerHTML = '';

            if (debates.length === 0) {
                debateList.innerHTML = '<div class="text-gray-500 text-center py-4">No debates yet. Start a new one!</div>';
                return;
            }

            // Add debates to list
            debates.forEach(debate => {
                const debateItem = document.createElement('div');
                debateItem.classList.add('debate-item');
                debateItem.dataset.id = debate._id;

                // Format date
                const date = new Date(debate.createdAt);
                const formattedDate = date.toLocaleDateString();

                debateItem.innerHTML = `
                    <div class="topic">${debate.topic}</div>
                    <div class="meta">
                        <span>${debate.stance}</span>
                        <span>${formattedDate}</span>
                    </div>
                `;

                debateItem.addEventListener('click', () => loadDebate(debate._id));
                debateList.appendChild(debateItem);
            });
        } catch (error) {
            console.error('Error loading debates:', error);
            // Only show notification if it's not a missing element error
            if (debateList) {
                showNotification('Error loading debates. Please try again.', 'error');
            }
        }
    }

    async function loadDebate(debateId) {
        try {
            // Check if required elements exist
            if (!chatMessages || !currentTopic || !userInput || !sendButton) {
                console.warn('Required DOM elements not found');
                return; // Exit early if elements don't exist
            }

            // Update active debate in UI
            document.querySelectorAll('.debate-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.id === debateId) {
                    item.classList.add('active');
                }
            });

            // Ensure debateId is a string
            const safeDebateId = String(debateId);
            console.log('Loading debate with ID:', safeDebateId);

            const response = await fetch(`/api/debates/${safeDebateId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to load debate');
            }

            const debate = await response.json();
            console.log('Debate loaded successfully:', debate);

            // Update current debate ID
            currentDebateId = safeDebateId;

            // Update topic
            currentTopic.textContent = debate.topic;

            // Clear messages
            chatMessages.innerHTML = '';

            // Hide empty state if it exists
            const emptyState = document.getElementById('empty-state');
            if (emptyState) {
                emptyState.style.display = 'none';
            }

            // Add messages
            if (Array.isArray(debate.messages)) {
                debate.messages.forEach(message => {
                    addMessage(message.content, message.role);
                });
            } else {
                console.warn('Debate messages is not an array:', debate.messages);
            }

            // Enable input if debate is active
            userInput.disabled = !debate.isActive;
            sendButton.disabled = !debate.isActive;

            if (!debate.isActive) {
                showNotification('This debate has been closed. You cannot add more messages.', 'info');
            }
        } catch (error) {
            console.error('Error loading debate:', error);
            // Only show notification if we have the required elements
            if (chatMessages && currentTopic) {
                showNotification('Error loading debate. Please try again.', 'error');
            }
        }
    }

    async function handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const user = await response.json();

            // Save user info
            localStorage.setItem('userId', user._id);
            localStorage.setItem('username', user.username);

            // Update state
            userId = user._id;
            username = user.username;

            // Close modal and update UI using Alpine.js
            try {
              const alpineRoot = document.querySelector('[x-data]');
              if (alpineRoot && alpineRoot.__x) {
                alpineRoot.__x.$data.showLogin = false;
                alpineRoot.__x.$data.userId = user._id;
                alpineRoot.__x.$data.username = user.username;
              } else {
                console.warn('Alpine.js data not found, using alternative method');
                // Alternative method
                window.dispatchEvent(new CustomEvent('alpine:login', { detail: { userId: user._id, username: user.username } }));
              }
            } catch (err) {
              console.error('Error updating Alpine.js data:', err);
            }

            // Load debates
            loadDebates(userId);

            showNotification(`Welcome back, ${user.username}!`, 'success');
        } catch (error) {
            console.error('Login error:', error);
            showNotification(error.message || 'Login failed. Please try again.', 'error');
        }
    }

    async function handleRegister(e) {
        e.preventDefault();

        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await fetch('/api/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Registration failed');
            }

            const user = await response.json();

            // Close modal and update UI using Alpine.js
            try {
              const alpineRoot = document.querySelector('[x-data]');
              if (alpineRoot && alpineRoot.__x) {
                alpineRoot.__x.$data.showRegister = false;
                // Show success message
                showNotification('Registration successful! You can now log in.', 'success');
                // Open login modal
                alpineRoot.__x.$data.showLogin = true;
              } else {
                console.warn('Alpine.js data not found, using alternative method');
                // Alternative method
                showNotification('Registration successful! You can now log in.', 'success');
                window.dispatchEvent(new CustomEvent('alpine:register-success'));
              }
            } catch (err) {
              console.error('Error updating Alpine.js data:', err);
              showNotification('Registration successful! You can now log in.', 'success');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotification(error.message || 'Registration failed. Please try again.', 'error');
        }
    }

    async function handleNewDebate(e) {
        e.preventDefault();

        const topic = document.getElementById('debate-topic').value;
        const stance = document.querySelector('input[name="stance"]:checked').value;

        try {
            const response = await fetch('/api/debates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic,
                    stance,
                    userId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create debate');
            }

            const debate = await response.json();

            // Close modal and reset form
            try {
              const alpineRoot = document.querySelector('[x-data]');
              if (alpineRoot && alpineRoot.__x) {
                alpineRoot.__x.$data.showNewDebate = false;
              } else {
                console.warn('Alpine.js data not found, using alternative method');
                // Alternative method
                window.dispatchEvent(new CustomEvent('alpine:close-debate-modal'));
              }
            } catch (err) {
              console.error('Error updating Alpine.js data:', err);
            }

            // Reset form
            document.getElementById('debate-topic').value = '';

            // Show success notification first
            showNotification('New debate created!', 'success');

            // Add a small delay before loading the debate to ensure the server has processed it
            setTimeout(() => {
                try {
                    // Load the new debate
                    if (debate && debate._id) {
                        console.log('Loading newly created debate:', debate._id);
                        loadDebate(debate._id);
                    } else {
                        console.error('Invalid debate object returned from server:', debate);
                    }

                    // Reload debates list in the background
                    if (userId) {
                        loadDebates(userId);
                    }
                } catch (err) {
                    console.error('Error loading new debate:', err);
                }
            }, 500); // 500ms delay
        } catch (error) {
            console.error('Error creating debate:', error);
            showNotification(error.message || 'Failed to create debate. Please try again.', 'error');
        }
    }

    // Add logout function to window for Alpine.js access
    window.logout = function() {
        // Clear user data
        localStorage.removeItem('userId');
        localStorage.removeItem('username');

        // Update state
        userId = null;
        username = null;
        currentDebateId = null;

        // Update UI
        try {
            const alpineRoot = document.querySelector('[x-data]');
            if (alpineRoot && alpineRoot.__x) {
                alpineRoot.__x.$data.userId = null;
                alpineRoot.__x.$data.username = null;
                alpineRoot.__x.$data.currentDebateId = null;
            } else {
                console.warn('Alpine.js data not found, using alternative method');
                // Alternative method
                window.dispatchEvent(new CustomEvent('alpine:logout'));
            }
        } catch (err) {
            console.error('Error updating Alpine.js data:', err);
        }

        // Clear debate list
        debateList.innerHTML = '<div class="text-gray-500 text-center py-4">Please log in to see your debates</div>';

        // Clear chat
        chatMessages.innerHTML = '';
        emptyState.style.display = 'flex';

        // Update topic
        currentTopic.textContent = 'Select or start a new debate';

        // Disable input
        userInput.disabled = true;
        sendButton.disabled = true;

        showNotification('You have been logged out', 'info');
    };

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.classList.add('fixed', 'bottom-4', 'right-4', 'p-4', 'rounded-md', 'shadow-lg', 'z-50', 'transition-all', 'duration-300');

        // Set color based on type
        if (type === 'error') {
            notification.classList.add('bg-red-500', 'text-white');
        } else if (type === 'success') {
            notification.classList.add('bg-green-500', 'text-white');
        } else {
            notification.classList.add('bg-blue-500', 'text-white');
        }

        notification.textContent = message;

        // Add to DOM
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.add('transform', 'translate-y-0', 'opacity-100');
        }, 10);

        // Remove after delay
        setTimeout(() => {
            notification.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Tech-inspired background effect
    createMatrixBackground();
});

function createMatrixBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '-1';
    canvas.style.opacity = '0.05'; // Very subtle effect
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const columns = canvas.width / 20;
    const drops = [];

    for (let i = 0; i < columns; i++) {
        drops[i] = 1;
    }

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0f0';
        ctx.font = '15px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = characters.charAt(Math.floor(Math.random() * characters.length));
            ctx.fillText(text, i * 20, drops[i] * 20);

            if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }

            drops[i]++;
        }
    }

    setInterval(draw, 35);

    // Resize handler
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}
