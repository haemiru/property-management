const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fwlrmynlpbhusvzvlsmp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bHJteW5scGJodXN2enZsc21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAzMTgsImV4cCI6MjA4NTc1NjMxOH0.izHAtEXIpKi7LasNvZJ69NLlBWUQ1lvae6XWF8rJDS4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Testing INSERT...");
    const id = 'test-' + Date.now();
    const property = {
        id: id,
        title: 'Debug Property ' + id,
        type: '주택', // PropertyType.HOUSE
        transactionType: '매매', // TransactionType.SALE
        price: '1억',
        priceAmount: 100000,
        address: 'Test Address',
        description: 'Test Description',
        images: [],
        createdAt: Date.now(),
        // Potentially problematic fields
        water: ['상수도'],
        sewage: ['직관연결'],
        buildings: [{ id: 'b1', name: 'Main', area: 100 }]
    };

    const { error } = await supabase
        .from('properties')
        .insert([property]);

    if (error) {
        console.error("Insert failed:", error);
    } else {
        console.log("Insert successful!");
        // Clean up
        await supabase.from('properties').delete().eq('id', id);
    }
}

test();
