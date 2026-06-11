CREATE TABLE IF NOT EXISTS predefined_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    html_content TEXT NOT NULL,
    sample_data JSONB NOT NULL DEFAULT '{}',
    preview_image VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
