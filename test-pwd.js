const bcrypt = require('bcryptjs'); 
console.log('pwd1:', bcrypt.compareSync('password', '$2b$10$rK8mEqwZBKfW4PqN5pAHYO1KmkELpJbF3r4wT2gBqPZ1vMhXDa3Hy'));
console.log('pwd2:', bcrypt.compareSync('password123', '$2b$10$rK8mEqwZBKfW4PqN5pAHYO1KmkELpJbF3r4wT2gBqPZ1vMhXDa3Hy'));
console.log('pwd3:', bcrypt.compareSync('123456', '$2b$10$rK8mEqwZBKfW4PqN5pAHYO1KmkELpJbF3r4wT2gBqPZ1vMhXDa3Hy'));
console.log('pwd4:', bcrypt.compareSync('admin123', '$2b$10$rK8mEqwZBKfW4PqN5pAHYO1KmkELpJbF3r4wT2gBqPZ1vMhXDa3Hy'));
