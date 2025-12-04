/*
  # Funciones para gestión de inventario
  
  1. Funciones Nuevas
    - `decrement_inventory`: Decrementa el inventario cuando se realiza una venta
    - Verifica que haya stock suficiente antes de decrementar
  
  2. Notas
    - Las funciones son seguras y verifican condiciones antes de ejecutar
    - Previenen ventas con stock insuficiente
*/

CREATE OR REPLACE FUNCTION decrement_inventory(
  producto_uuid uuid,
  punto_uuid uuid,
  cantidad_decrement integer
)
RETURNS void AS $$
DECLARE
  current_cantidad integer;
BEGIN
  SELECT cantidad INTO current_cantidad
  FROM inventario
  WHERE producto_id = producto_uuid AND punto_id = punto_uuid;

  IF current_cantidad IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado en inventario';
  END IF;

  IF current_cantidad < cantidad_decrement THEN
    RAISE EXCEPTION 'Stock insuficiente';
  END IF;

  UPDATE inventario
  SET cantidad = cantidad - cantidad_decrement
  WHERE producto_id = producto_uuid AND punto_id = punto_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
