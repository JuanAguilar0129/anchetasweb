DO $$
DECLARE
  admin_user_id uuid;
  punto_principal_id uuid;
  producto_ids uuid[];
BEGIN
  admin_user_id := '00000000-0000-0000-0000-000000000001';
  
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = admin_user_id) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,  -- Contraseña sin encriptación
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    ) VALUES (
      admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@anchetas.local',
      'admin123',  -- Contraseña sin encriptación
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_user_id) THEN
    INSERT INTO profiles (id, nombre, codigo_usuario, rol, activo)
    VALUES (admin_user_id, 'Administrador General', 'admin', 'admin_general', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM puntos_venta WHERE nombre = 'Punto Principal') THEN
    INSERT INTO puntos_venta (nombre, direccion, activo)
    VALUES ('Punto Principal', 'Calle Principal #123, Centro', true)
    RETURNING id INTO punto_principal_id;

    INSERT INTO usuarios_puntos (user_id, punto_id)
    VALUES (admin_user_id, punto_principal_id);
  ELSE
    SELECT id INTO punto_principal_id FROM puntos_venta WHERE nombre = 'Punto Principal' LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM productos LIMIT 1) THEN
    WITH inserted_productos AS (
      INSERT INTO productos (nombre, descripcion, precio_venta, imagen_url, activo)
      VALUES
        ('Ancheta Deluxe', 'Ancheta premium con productos gourmet, vinos y chocolates finos', 250000, 'https://images.pexels.com/photos/264869/pexels-photo-264869.jpeg', true),
        ('Ancheta Ejecutiva', 'Ancheta corporativa con productos selectos para empresas', 180000, 'https://images.pexels.com/photos/1400172/pexels-photo-1400172.jpeg', true),
        ('Ancheta Familiar', 'Ancheta grande con variedad de productos para toda la familia', 150000, 'https://images.pexels.com/photos/3850838/pexels-photo-3850838.jpeg', true),
        ('Ancheta Dulce', 'Ancheta con chocolates, dulces y productos de repostería', 120000, 'https://images.pexels.com/photos/3631/summer-dessert-sweet-ice-cream.jpg', true),
        ('Ancheta de Café', 'Ancheta con café premium, tazas y accesorios', 95000, 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg', true),
        ('Ancheta Navideña', 'Ancheta especial con productos navideños y decoración', 200000, 'https://images.pexels.com/photos/749353/pexels-photo-749353.jpeg', true),
        ('Ancheta Romántica', 'Ancheta para ocasiones especiales con vinos y chocolates', 160000, 'https://images.pexels.com/photos/1090972/pexels-photo-1090972.jpeg', true),
        ('Ancheta Gourmet', 'Ancheta con productos gourmet importados y locales', 220000, 'https://images.pexels.com/photos/1435735/pexels-photo-1435735.jpeg', true)
      RETURNING id
    )
    SELECT array_agg(id) INTO producto_ids FROM inserted_productos;

    INSERT INTO inventario (producto_id, punto_id, cantidad, stock_minimo)
    SELECT
      unnest(producto_ids),
      punto_principal_id,
      floor(random() * 20 + 10)::integer,
      5;
  END IF;
END $$;
