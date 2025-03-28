const request = require('supertest');
const express = require('express'); // Import express to potentially create a test app instance if needed
const path = require('path');
const fs = require('fs');

// Mock the 'fs' module
jest.mock('fs');

// Import the actual app instance from the refactored server.js
const app = require('../server'); // Now this should work
const Tesseract = require('tesseract.js'); // Keep import if needed elsewhere, but remove terminate

describe('Expense API Endpoints', () => {
    let mockExpenses = [];

    // Removed afterAll block for Tesseract termination

    beforeEach(() => {
        // Reset mocks before each test
        mockExpenses = [
            { id: '1', type: 'Test', date: '2024-01-01', vendor: 'Test Vendor', location: 'Test Location', cost: 10.00, tripName: 'Test Trip' },
            { id: '2', type: 'Test 2', date: '2024-01-02', vendor: 'Test Vendor 2', location: 'Test Location 2', cost: 20.50, tripName: 'Test Trip' }
        ];
        // Setup mock implementation for fs.readFileSync
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath === path.join(__dirname, '../data.json') || filePath === 'mock_data.json') {
                return JSON.stringify(mockExpenses);
            }
            throw new Error('File not found in mock');
        });
         // Setup mock implementation for fs.writeFileSync
         fs.writeFileSync.mockImplementation((filePath, data) => {
             if (filePath === path.join(__dirname, '../data.json') || filePath === 'mock_data.json') {
                 // Optionally, update mockExpenses to reflect write for subsequent reads in the same test
                 mockExpenses = JSON.parse(data);
             } else {
                 throw new Error('Attempted to write to unexpected file in mock');
             }
         });
         // Setup mock implementation for fs.existsSync
         fs.existsSync.mockImplementation((filePath) => {
             // Allow checking for data file and uploads directory
             return (filePath === path.join(__dirname, '../data.json') || filePath === path.join(__dirname, '../uploads'));
         });
         // Mock mkdirSync used by multer setup
         fs.mkdirSync.mockImplementation((dirPath) => {
            // console.log(`Mock fs.mkdirSync called for: ${dirPath}`); // Optional logging
            return undefined; // Simulate successful directory creation/check
         });
         // Make writeFileSync less strict for multer's temp files
         const originalWriteFileSync = fs.writeFileSync; // Keep original if needed? No, mock fully.
         fs.writeFileSync.mockImplementation((filePath, data) => {
             const targetPath = path.join(__dirname, '../data.json');
             // Only intercept writes to the actual data file for testing state
             if (filePath === targetPath) {
                 // console.log(`Mock fs.writeFileSync intercepted for data file: ${filePath}`);
                 mockExpenses = JSON.parse(data);
             } else {
                 // Allow other writes (like multer temp files) to proceed without error in mock
                 // console.log(`Mock fs.writeFileSync allowed for: ${filePath}`);
             }
         });
    });

    // Test GET /api/expenses
    it('should fetch all expenses', async () => {
        const res = await request(app).get('/api/expenses');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body.length).toEqual(mockExpenses.length);
        expect(res.body[0]).toHaveProperty('id', '1');
        expect(res.body[1]).toHaveProperty('tripName', 'Test Trip');
    });

    // Test POST /api/expenses - Basic success case
    it('should add a new expense', async () => {
        const newExpenseData = {
            type: 'Food',
            date: '2024-03-15', // Ensure valid format
            vendor: 'Super Cafe',
            location: 'Downtown',
            cost: 15.75,
            comments: 'Lunch meeting',
            tripName: 'Work Trip'
            // Assuming receipt handling is tested separately or mocked implicitly
        };

        const res = await request(app)
            .post('/api/expenses')
            // Simulate sending form data fields instead of JSON
            .field('type', newExpenseData.type)
            .field('date', newExpenseData.date)
            .field('vendor', newExpenseData.vendor)
            .field('location', newExpenseData.location)
            .field('cost', newExpenseData.cost.toString()) // Ensure cost is sent as string like form data
            .field('comments', newExpenseData.comments)
            .field('tripName', newExpenseData.tripName)
            // Attach a dummy file buffer to satisfy the req.file check
            .attach('receipt', Buffer.from('dummy receipt content'), 'dummy.txt');

        // Log response body if status is not 201
        if (res.statusCode !== 201) {
            console.error('POST /api/expenses failed response body:', JSON.stringify(res.body));
        }

        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('message', 'Expense added successfully');
        expect(res.body).toHaveProperty('expense');
        expect(res.body.expense).toHaveProperty('id'); // ID is generated by server
        expect(res.body.expense.type).toEqual(newExpenseData.type);
        expect(res.body.expense.vendor).toEqual(newExpenseData.vendor);
        expect(res.body.expense.cost).toEqual(newExpenseData.cost);
        expect(res.body.expense.tripName).toEqual(newExpenseData.tripName);

        // Verify writeFileSync was called (optional)
        // expect(fs.writeFileSync).toHaveBeenCalled();
        // expect(fs.writeFileSync).toHaveBeenCalledWith(
        //     expect.stringContaining('data.json'), // Check path contains data.json
        //     expect.any(String) // Check data is a string
        // );
    });

    // TODO: Add tests for POST validation errors (missing fields, invalid data)
    // TODO: Add tests for PUT /api/expenses/:id
    // TODO: Add tests for DELETE /api/expenses/:id
    // TODO: Add tests for GET /api/export-expenses
    // TODO: Add tests for POST /api/test-ocr (mocking Gemini API call)
});