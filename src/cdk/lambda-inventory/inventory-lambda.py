"""
Lambda handler wrapper for inventory CSV generation
Deploy alongside inventory-handler.py
"""
import json
import os
import sys
import importlib.util

def lambda_handler(event, context):
    """
    Simple wrapper that loads and calls inventory-handler.py
    """
    print(f"[inventory-wrapper] Received event: {json.dumps(event)}")
    
    # Parse teamId from the direct invocation event
    team_id = event.get('teamId')
    
    if not team_id:
        print("[inventory-wrapper] ERROR: teamId is missing")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'ok': False,
                'error': 'teamId is required'
            })
        }
    
    print(f"[inventory-wrapper] TeamId: {team_id}")
    
    # Load the actual handler module dynamically
    handler_path = os.path.join(os.path.dirname(__file__), 'inventory-handler.py')
    spec = importlib.util.spec_from_file_location("handler_inventory", handler_path)
    handler = importlib.util.module_from_spec(spec)
    sys.modules['handler_inventory'] = handler
    spec.loader.exec_module(handler)
    
    print(f"[inventory-wrapper] Calling handler.lambda_handler with wrapped event")
    
    try:
        # Wrap the event to look like API Gateway format
        wrapped_event = {
            'httpMethod': 'POST',
            'body': json.dumps({'teamId': team_id})
        }
        
        result = handler.lambda_handler(wrapped_event, context)
        print(f"[inventory-wrapper] Handler returned statusCode: {result.get('statusCode')}")
        print(f"[inventory-wrapper] Response body preview: {str(result.get('body'))[:200]}")
        return result
        
    except Exception as e:
        print(f"[inventory-wrapper] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({
                'ok': False,
                'error': str(e)
            })
        }